const inventoryService = require('../services/inventoryService');

// POST /api/inventory/lots
const registerLot = async (req, res, next) => {
  try {
    const { productId, supplierId, quantity, purchasePrice, expirationDate, lotCode } = req.body;
    if (!productId || !quantity || !purchasePrice) {
      return res.status(400).json({ success: false, message: 'productId, quantity y purchasePrice son requeridos.' });
    }
    const lot = await inventoryService.registerLot({
      productId: parseInt(productId),
      supplierId: supplierId ? parseInt(supplierId) : null,
      quantity: parseFloat(quantity),
      purchasePrice: parseFloat(purchasePrice),
      expirationDate,
      lotCode,
      userId: req.user.id,
    });

    const io = req.app.get('io');
    if (io) io.emit('inventory:lotAdded', lot);

    res.status(201).json({ success: true, message: 'Lote registrado exitosamente.', data: lot });
  } catch (error) { next(error); }
};

// GET /api/inventory/lots
const getLots = async (req, res, next) => {
  try {
    const { page, limit, status, productId } = req.query;
    const result = await inventoryService.getAllLots({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status, productId,
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

// GET /api/inventory/summary
const getSummary = async (req, res, next) => {
  try {
    const summary = await inventoryService.getInventorySummary();
    res.json({ success: true, data: summary });
  } catch (error) { next(error); }
};

// GET /api/inventory/movements
const getMovements = async (req, res, next) => {
  try {
    const { page, limit, productId, movementType } = req.query;
    const result = await inventoryService.getMovements({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 30,
      productId, movementType,
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

// GET /api/inventory/stock/:productId
const getProductStock = async (req, res, next) => {
  try {
    const result = await inventoryService.getProductStock(parseInt(req.params.productId));
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

// POST /api/inventory/check-expirations
const checkExpirationsNow = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const { checkExpirations } = require('../jobs/expirationJob');
    await checkExpirations(io);

    const now = new Date();
    const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const prisma = require('../config/database');
    const expiredCount = await prisma.inventoryLot.count({
      where: {
        quantityRemaining: { gt: 0 },
        OR: [
          { status: 'EXPIRED' },
          { expirationDate: { not: null, lte: now } },
        ],
      },
    });

    const soonCount = await prisma.inventoryLot.count({
      where: {
        status: 'ACTIVE',
        quantityRemaining: { gt: 0 },
        expirationDate: { not: null, gt: now, lte: threeDays },
      },
    });

    res.json({
      success: true,
      message: 'Verificación de caducidad ejecutada exitosamente.',
      data: { expiredCount, soonCount },
    });
  } catch (error) { next(error); }
};

// GET /api/inventory/expired-lots
const getExpiredLots = async (req, res, next) => {
  try {
    const prisma = require('../config/database');
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const lots = await prisma.inventoryLot.findMany({
      where: {
        quantityRemaining: { gt: 0 },
        OR: [
          { status: 'EXPIRED' },
          { expirationDate: { not: null, lte: sevenDays } },
        ],
      },
      include: {
        product: { select: { id: true, name: true, unitOfMeasure: true, currentPrice: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { expirationDate: 'asc' },
    });

    const formatted = lots.map((lot) => {
      const isExpired = lot.status === 'EXPIRED' || (lot.expirationDate && new Date(lot.expirationDate) < now);
      const daysUntil = lot.expirationDate
        ? Math.ceil((new Date(lot.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const lossAmount = Math.round(lot.quantityRemaining * lot.purchasePrice * 100) / 100;

      return {
        ...lot,
        isExpired,
        daysUntil,
        lossAmount,
      };
    });

    res.json({ success: true, data: formatted });
  } catch (error) { next(error); }
};

// POST /api/inventory/lots/:id/discard
const discardLot = async (req, res, next) => {
  try {
    const prisma = require('../config/database');
    const lotId = parseInt(req.params.id);
    const { reason = 'Descarte por producto vencido' } = req.body;

    const lot = await prisma.inventoryLot.findUnique({
      where: { id: lotId },
      include: { product: true },
    });

    if (!lot) return res.status(404).json({ success: false, message: 'Lote no encontrado.' });
    if (lot.quantityRemaining <= 0) {
      return res.status(400).json({ success: false, message: 'Este lote ya no tiene existencias para descartar.' });
    }

    const discardedQty = lot.quantityRemaining;
    const lossAmount = Math.round(discardedQty * lot.purchasePrice * 100) / 100;

    // Registrar movimiento de desperdicio/merma
    const movement = await prisma.inventoryMovement.create({
      data: {
        productId: lot.productId,
        lotId: lot.id,
        userId: req.user.id,
        movementType: 'WASTE',
        quantity: discardedQty,
        reason: `${reason} (Lote: ${lot.lotCode || '#' + lot.id}) - Pérdida: $${lossAmount.toFixed(2)}`,
      },
    });

    // Marcar lote con stock 0 y estado EXPIRED
    await prisma.inventoryLot.update({
      where: { id: lot.id },
      data: {
        quantityRemaining: 0,
        status: 'EXPIRED',
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('inventory:lotDiscarded', { lotId: lot.id, productId: lot.productId });
      io.emit('inventory:lotUpdated', lot);
    }

    res.json({
      success: true,
      message: `Se descartaron ${discardedQty} ${lot.product.unitOfMeasure} del insumo "${lot.product.name}". Pérdida por merma: $${lossAmount.toFixed(2)}.`,
      data: { movement, lossAmount },
    });
  } catch (error) { next(error); }
};

// POST /api/inventory/discard-expired-all
const discardAllExpired = async (req, res, next) => {
  try {
    const prisma = require('../config/database');
    const now = new Date();

    const expiredLots = await prisma.inventoryLot.findMany({
      where: {
        quantityRemaining: { gt: 0 },
        OR: [
          { status: 'EXPIRED' },
          { expirationDate: { not: null, lte: now } },
        ],
      },
      include: { product: true },
    });

    if (expiredLots.length === 0) {
      return res.json({
        success: true,
        message: 'No hay productos vencidos pendientes por descartar en el almacén.',
        count: 0,
        totalLoss: 0,
      });
    }

    let totalLoss = 0;

    for (const lot of expiredLots) {
      const qty = lot.quantityRemaining;
      const loss = Math.round(qty * lot.purchasePrice * 100) / 100;
      totalLoss += loss;

      await prisma.inventoryMovement.create({
        data: {
          productId: lot.productId,
          lotId: lot.id,
          userId: req.user.id,
          movementType: 'WASTE',
          quantity: qty,
          reason: `Descarte masivo de vencidos (Lote: ${lot.lotCode || '#' + lot.id}) - Pérdida: $${loss.toFixed(2)}`,
        },
      });

      await prisma.inventoryLot.update({
        where: { id: lot.id },
        data: { quantityRemaining: 0, status: 'EXPIRED' },
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('inventory:lotDiscarded', { count: expiredLots.length });
    }

    res.json({
      success: true,
      message: `Se descartaron exitosamente ${expiredLots.length} lotes vencidos. Pérdida total registrada por merma: $${totalLoss.toFixed(2)}.`,
      count: expiredLots.length,
      totalLoss: Math.round(totalLoss * 100) / 100,
    });
  } catch (error) { next(error); }
};

module.exports = {
  registerLot,
  getLots,
  getSummary,
  getMovements,
  getProductStock,
  checkExpirationsNow,
  getExpiredLots,
  discardLot,
  discardAllExpired,
};
