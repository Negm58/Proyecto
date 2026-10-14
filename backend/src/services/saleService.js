const prisma = require('../config/database');
const inventoryService = require('./inventoryService');

class SaleService {
  /**
   * Registrar una venta con descuento automático de inventario (FIFO)
   */
  async createSale({ userId, items, paymentMethod }) {
    if (!items || items.length === 0) {
      throw Object.assign(new Error('La venta debe tener al menos un item.'), { statusCode: 400 });
    }

    // Validar items y obtener precios
    let totalAmount = 0;
    let totalCost = 0;
    const saleItemsData = [];

    for (const item of items) {
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: item.menuItemId },
        include: {
          recipeItems: { include: { product: true } },
          comboParent: {
            include: {
              menuItem: {
                include: { recipeItems: { include: { product: true } } },
              },
            },
          },
        },
      });

      if (!menuItem || !menuItem.isActive) {
        throw Object.assign(
          new Error(`Plato "${item.menuItemId}" no encontrado o no disponible.`),
          { statusCode: 404 }
        );
      }

      const unitPrice = menuItem.salePrice;
      const subtotal = unitPrice * item.quantity;

      saleItemsData.push({
        menuItemId: menuItem.id,
        quantity: item.quantity,
        unitPrice,
        subtotal,
      });

      totalAmount += subtotal;
      totalCost += menuItem.productionCost * item.quantity;

      // Descontar inventario por cada item de la receta
      const recipeItems = menuItem.type === 'COMBO'
        ? this.getComboRecipeItems(menuItem)
        : menuItem.recipeItems;

      for (const recipe of recipeItems) {
        const totalNeeded = recipe.quantityNeeded * item.quantity;
        await inventoryService.deductInventoryFIFO(
          recipe.productId,
          totalNeeded,
          userId,
          `Venta: ${menuItem.name} x${item.quantity}`
        );
      }
    }

    // Crear la venta
    const sale = await prisma.sale.create({
      data: {
        userId,
        totalAmount,
        totalCost,
        paymentMethod: paymentMethod || 'EFECTIVO',
        saleItems: {
          create: saleItemsData,
        },
      },
      include: {
        saleItems: {
          include: { menuItem: { select: { name: true } } },
        },
        user: { select: { name: true } },
      },
    });

    return sale;
  }

  /**
   * Obtener los items de receta de un combo (incluyendo los platos dentro del combo)
   */
  getComboRecipeItems(comboMenuItem) {
    const allRecipeItems = [];

    // Receta propia del combo
    allRecipeItems.push(...comboMenuItem.recipeItems);

    // Recetas de cada plato del combo
    for (const comboItem of comboMenuItem.comboParent || []) {
      for (const recipe of comboItem.menuItem.recipeItems) {
        allRecipeItems.push({
          ...recipe,
          quantityNeeded: recipe.quantityNeeded * comboItem.quantity,
        });
      }
    }

    return allRecipeItems;
  }

  /**
   * Obtener historial de ventas
   */
  async getSales({ page = 1, limit = 20, startDate, endDate, status }) {
    const where = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate);
      if (endDate) where.saleDate.lte = new Date(endDate);
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        saleItems: {
          include: { menuItem: { select: { name: true, type: true } } },
        },
        user: { select: { name: true } },
      },
      orderBy: { saleDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.sale.count({ where });

    return { sales, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Cancelar una venta (no restaura inventario por seguridad)
   */
  async cancelSale(saleId) {
    return prisma.sale.update({
      where: { id: saleId },
      data: { status: 'CANCELLED' },
    });
  }
}

module.exports = new SaleService();
