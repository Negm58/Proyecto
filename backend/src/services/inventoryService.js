const prisma = require('../config/database');
const { MOVEMENT_TYPES, LOT_STATUS, ALERT_TYPES } = require('../utils/constants');

class InventoryService {
  /**
   * Registrar un nuevo lote de producto (entrada al inventario)
   */
  async registerLot({ productId, supplierId, quantity, purchasePrice, expirationDate, lotCode, userId }) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw Object.assign(new Error('Producto no encontrado.'), { statusCode: 404 });

    // Crear lote
    const lot = await prisma.inventoryLot.create({
      data: {
        productId,
        supplierId: supplierId || null,
        quantityInitial: quantity,
        quantityRemaining: quantity,
        purchasePrice,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        lotCode: lotCode || `LOT-${Date.now()}`,
      },
      include: { product: true, supplier: true },
    });

    // Registrar movimiento de entrada
    await prisma.inventoryMovement.create({
      data: {
        productId,
        lotId: lot.id,
        userId,
        movementType: MOVEMENT_TYPES.ENTRY,
        quantity,
        reason: `Ingreso de lote ${lot.lotCode}`,
      },
    });

    // Actualizar precio actual del producto si cambió
    const oldPrice = product.currentPrice;
    if (purchasePrice !== oldPrice) {
      await prisma.product.update({
        where: { id: productId },
        data: { currentPrice: purchasePrice },
      });

      // Registrar historial de precio
      await prisma.priceHistory.create({
        data: {
          productId,
          supplierId: supplierId || null,
          oldPrice,
          newPrice: purchasePrice,
        },
      });
    }

    // Actualizar relación producto-proveedor
    if (supplierId) {
      await prisma.productSupplier.upsert({
        where: { productId_supplierId: { productId, supplierId } },
        update: { lastPrice: purchasePrice, lastPurchaseDate: new Date() },
        create: { productId, supplierId, lastPrice: purchasePrice, lastPurchaseDate: new Date() },
      });
    }

    return lot;
  }

  /**
   * Obtener stock total de un producto (suma de lotes activos)
   */
  async getProductStock(productId) {
    const lots = await prisma.inventoryLot.findMany({
      where: {
        productId,
        status: LOT_STATUS.ACTIVE,
        quantityRemaining: { gt: 0 },
      },
      orderBy: { entryDate: 'asc' }, // FIFO
    });

    const totalStock = lots.reduce((sum, lot) => sum + lot.quantityRemaining, 0);
    return { totalStock, lots };
  }

  /**
   * Descontar inventario usando lógica FIFO
   * Consume primero del lote más antiguo
   */
  async deductInventoryFIFO(productId, quantityNeeded, userId, reason = 'Venta') {
    let remaining = quantityNeeded;

    // Obtener lotes activos ordenados por fecha de entrada (FIFO)
    const lots = await prisma.inventoryLot.findMany({
      where: {
        productId,
        status: LOT_STATUS.ACTIVE,
        quantityRemaining: { gt: 0 },
      },
      orderBy: { entryDate: 'asc' },
    });

    const totalAvailable = lots.reduce((sum, lot) => sum + lot.quantityRemaining, 0);

    if (totalAvailable < quantityNeeded) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      throw Object.assign(
        new Error(`Stock insuficiente de "${product?.name || productId}". Disponible: ${totalAvailable}, Requerido: ${quantityNeeded}`),
        { statusCode: 400 }
      );
    }

    const movements = [];

    for (const lot of lots) {
      if (remaining <= 0) break;

      const deduction = Math.min(lot.quantityRemaining, remaining);
      const newRemaining = lot.quantityRemaining - deduction;

      // Actualizar lote
      await prisma.inventoryLot.update({
        where: { id: lot.id },
        data: {
          quantityRemaining: newRemaining,
          status: newRemaining <= 0 ? LOT_STATUS.DEPLETED : LOT_STATUS.ACTIVE,
        },
      });

      // Registrar movimiento
      const movement = await prisma.inventoryMovement.create({
        data: {
          productId,
          lotId: lot.id,
          userId,
          movementType: MOVEMENT_TYPES.SALE_DEDUCTION,
          quantity: deduction,
          reason,
        },
      });

      movements.push(movement);
      remaining -= deduction;
    }

    // Verificar stock bajo después del descuento
    await this.checkLowStock(productId);

    return movements;
  }

  /**
   * Verificar si el stock de un producto está bajo el umbral mínimo
   */
  async checkLowStock(productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return;

    const { totalStock } = await this.getProductStock(productId);

    if (totalStock <= product.minStockThreshold) {
      // Verificar si ya existe una alerta activa
      const existingAlert = await prisma.alert.findFirst({
        where: {
          productId,
          alertType: ALERT_TYPES.LOW_STOCK,
          isRead: false,
        },
      });

      if (!existingAlert) {
        await prisma.alert.create({
          data: {
            productId,
            alertType: ALERT_TYPES.LOW_STOCK,
            message: `⚠️ Stock bajo de "${product.name}": ${totalStock} ${product.unitOfMeasure} (mínimo: ${product.minStockThreshold})`,
          },
        });
      }
    }
  }

  /**
   * Verificar productos próximos a vencer (dentro de los próximos X días)
   */
  async checkExpirations(daysAhead = 7) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    // Productos próximos a vencer
    const expiringSoon = await prisma.inventoryLot.findMany({
      where: {
        status: LOT_STATUS.ACTIVE,
        quantityRemaining: { gt: 0 },
        expirationDate: {
          not: null,
          lte: futureDate,
          gt: now,
        },
      },
      include: { product: true },
    });

    // Productos ya vencidos
    const expired = await prisma.inventoryLot.findMany({
      where: {
        status: LOT_STATUS.ACTIVE,
        quantityRemaining: { gt: 0 },
        expirationDate: {
          not: null,
          lte: now,
        },
      },
      include: { product: true },
    });

    // Crear alertas para próximos a vencer
    for (const lot of expiringSoon) {
      const existingAlert = await prisma.alert.findFirst({
        where: {
          productId: lot.productId,
          alertType: ALERT_TYPES.EXPIRING_SOON,
          isRead: false,
        },
      });

      if (!existingAlert) {
        await prisma.alert.create({
          data: {
            productId: lot.productId,
            alertType: ALERT_TYPES.EXPIRING_SOON,
            message: `🟡 "${lot.product.name}" (Lote ${lot.lotCode}) vence el ${lot.expirationDate.toLocaleDateString('es')}. Quedan ${lot.quantityRemaining} ${lot.product.unitOfMeasure}.`,
          },
        });
      }
    }

    // Marcar lotes vencidos y crear alertas
    for (const lot of expired) {
      await prisma.inventoryLot.update({
        where: { id: lot.id },
        data: { status: LOT_STATUS.EXPIRED },
      });

      await prisma.alert.create({
        data: {
          productId: lot.productId,
          alertType: ALERT_TYPES.EXPIRED,
          message: `🔴 "${lot.product.name}" (Lote ${lot.lotCode}) ha EXPIRADO. Cantidad: ${lot.quantityRemaining} ${lot.product.unitOfMeasure}.`,
        },
      });
    }

    return { expiringSoon: expiringSoon.length, expired: expired.length };
  }

  /**
   * Obtener todos los lotes con información de stock
   */
  async getAllLots({ page = 1, limit = 20, status, productId, search }) {
    const where = {};
    if (status) where.status = status;
    if (productId) where.productId = parseInt(productId);

    const lots = await prisma.inventoryLot.findMany({
      where,
      include: {
        product: { select: { name: true, unitOfMeasure: true, minStockThreshold: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { entryDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.inventoryLot.count({ where });

    return { lots, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Obtener resumen de inventario (stock por producto)
   */
  async getInventorySummary() {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: true,
        inventoryLots: {
          where: { status: LOT_STATUS.ACTIVE, quantityRemaining: { gt: 0 } },
        },
      },
      orderBy: { name: 'asc' },
    });

    return products.map((product) => {
      const totalStock = product.inventoryLots.reduce((sum, lot) => sum + lot.quantityRemaining, 0);
      const isLow = totalStock <= product.minStockThreshold;
      const nearestExpiry = product.inventoryLots
        .filter((lot) => lot.expirationDate)
        .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate))[0];

      return {
        id: product.id,
        name: product.name,
        category: product.category?.name,
        unitOfMeasure: product.unitOfMeasure,
        totalStock,
        minStockThreshold: product.minStockThreshold,
        currentPrice: product.currentPrice,
        isLow,
        nearestExpiry: nearestExpiry?.expirationDate || null,
        lotCount: product.inventoryLots.length,
      };
    });
  }

  /**
   * Obtener historial de movimientos
   */
  async getMovements({ page = 1, limit = 30, productId, movementType }) {
    const where = {};
    if (productId) where.productId = parseInt(productId);
    if (movementType) where.movementType = movementType;

    const movements = await prisma.inventoryMovement.findMany({
      where,
      include: {
        product: { select: { name: true, unitOfMeasure: true } },
        lot: { select: { lotCode: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.inventoryMovement.count({ where });

    return { movements, total, page, totalPages: Math.ceil(total / limit) };
  }
}

module.exports = new InventoryService();
