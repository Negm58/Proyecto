const prisma = require('../config/database');

// GET /api/stats/price-history
const getPriceHistory = async (req, res, next) => {
  try {
    const { productId, months } = req.query;
    const where = {};
    if (productId) where.productId = parseInt(productId);
    if (months) {
      const date = new Date();
      date.setMonth(date.getMonth() - parseInt(months));
      where.recordedAt = { gte: date };
    }

    const history = await prisma.priceHistory.findMany({
      where,
      include: {
        product: { select: { name: true, unitOfMeasure: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { recordedAt: 'desc' },
    });
    res.json({ success: true, data: history });
  } catch (error) { next(error); }
};

// GET /api/stats/sales-summary
const getSalesSummary = async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const sales = await prisma.sale.findMany({
      where: {
        saleDate: { gte: startDate },
        status: 'COMPLETED',
      },
      include: {
        saleItems: {
          include: { menuItem: { select: { name: true, type: true } } },
        },
      },
    });

    const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalCost = sales.reduce((sum, s) => sum + s.totalCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const totalSales = sales.length;

    // Top products
    const productSales = {};
    sales.forEach((sale) => {
      sale.saleItems.forEach((item) => {
        const name = item.menuItem.name;
        if (!productSales[name]) productSales[name] = { name, quantity: 0, revenue: 0 };
        productSales[name].quantity += item.quantity;
        productSales[name].revenue += item.subtotal;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Sales by day
    const salesByDay = {};
    sales.forEach((sale) => {
      const day = sale.saleDate.toISOString().split('T')[0];
      if (!salesByDay[day]) salesByDay[day] = { date: day, count: 0, revenue: 0 };
      salesByDay[day].count += 1;
      salesByDay[day].revenue += sale.totalAmount;
    });

    // Pérdidas por mermas en el período
    const shrinkageMovements = await prisma.inventoryMovement.findMany({
      where: {
        createdAt: { gte: startDate },
        movementType: { in: ['WASTE', 'EXPIRATION'] },
      },
      include: {
        product: { select: { currentPrice: true } },
        lot: { select: { purchasePrice: true } },
      },
    });

    const totalShrinkageLoss = Math.round(
      shrinkageMovements.reduce((sum, m) => {
        const unitCost = m.lot?.purchasePrice ?? m.product?.currentPrice ?? 0;
        return sum + m.quantity * unitCost;
      }, 0) * 100
    ) / 100;

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalCost,
        totalProfit,
        totalShrinkageLoss,
        profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0,
        totalSales,
        topProducts,
        salesByDay: Object.values(salesByDay).sort((a, b) => a.date.localeCompare(b.date)),
      },
    });
  } catch (error) { next(error); }
};

// GET /api/stats/inventory-rotation
const getInventoryRotation = async (req, res, next) => {
  try {
    const movements = await prisma.inventoryMovement.findMany({
      where: { movementType: 'SALE_DEDUCTION' },
      include: { product: { select: { name: true, unitOfMeasure: true } } },
    });

    const rotation = {};
    movements.forEach((m) => {
      const name = m.product.name;
      if (!rotation[name]) rotation[name] = { name, totalDeducted: 0, unit: m.product.unitOfMeasure, movementCount: 0 };
      rotation[name].totalDeducted += m.quantity;
      rotation[name].movementCount += 1;
    });

    const sorted = Object.values(rotation).sort((a, b) => b.totalDeducted - a.totalDeducted);
    res.json({ success: true, data: sorted });
  } catch (error) { next(error); }
};

// POST /api/stats/expenses
const createExpense = async (req, res, next) => {
  try {
    const { category, description, amount, expenseDate } = req.body;
    if (!category || !amount) {
      return res.status(400).json({ success: false, message: 'Categoría y monto son requeridos.' });
    }
    const expense = await prisma.operationalExpense.create({
      data: {
        userId: req.user.id,
        category,
        description,
        amount: parseFloat(amount),
        expenseDate: new Date(expenseDate || Date.now()),
      },
    });
    res.status(201).json({ success: true, data: expense });
  } catch (error) { next(error); }
};

// GET /api/stats/expenses
const getExpenses = async (req, res, next) => {
  try {
    const { startDate, endDate, category } = req.query;
    const where = {};
    if (category) where.category = category;
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate);
      if (endDate) where.expenseDate.lte = new Date(endDate);
    }

    const expenses = await prisma.operationalExpense.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { expenseDate: 'desc' },
    });

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Group by category
    const byCategory = {};
    expenses.forEach((e) => {
      if (!byCategory[e.category]) byCategory[e.category] = 0;
      byCategory[e.category] += e.amount;
    });

    res.json({ success: true, data: { expenses, totalAmount, byCategory } });
  } catch (error) { next(error); }
};

// GET /api/stats/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalProducts,
      totalMenuItems,
      todaySales,
      unreadAlerts,
      lowStockProducts,
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.menuItem.count({ where: { isActive: true } }),
      prisma.sale.findMany({ where: { saleDate: { gte: today }, status: 'COMPLETED' } }),
      prisma.alert.count({ where: { isRead: false } }),
      prisma.product.findMany({
        where: { isActive: true },
        include: {
          inventoryLots: {
            where: { status: 'ACTIVE', quantityRemaining: { gt: 0 } },
            select: { quantityRemaining: true },
          },
        },
      }),
    ]);

    const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
    const lowStock = lowStockProducts.filter((p) => {
      const stock = p.inventoryLots.reduce((sum, l) => sum + l.quantityRemaining, 0);
      return stock <= p.minStockThreshold;
    }).length;

    res.json({
      success: true,
      data: {
        totalProducts,
        totalMenuItems,
        todaySalesCount: todaySales.length,
        todayRevenue,
        unreadAlerts,
        lowStockCount: lowStock,
      },
    });
  } catch (error) { next(error); }
};

// GET /api/stats/shrinkage
const getShrinkage = async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(0); // Todo
    }

    const where = {
      movementType: { in: ['WASTE', 'EXPIRATION'] },
    };
    if (period !== 'all') {
      where.createdAt = { gte: startDate };
    }

    const movements = await prisma.inventoryMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, unitOfMeasure: true, currentPrice: true } },
        lot: { select: { id: true, lotCode: true, purchasePrice: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalLoss = 0;
    let totalItems = 0;

    const formattedMovements = movements.map((m) => {
      const unitCost = m.lot?.purchasePrice ?? m.product?.currentPrice ?? 0;
      const loss = Math.round(m.quantity * unitCost * 100) / 100;
      totalLoss += loss;
      totalItems += m.quantity;

      return {
        id: m.id,
        date: m.createdAt,
        productName: m.product?.name || 'Insumo',
        unitOfMeasure: m.product?.unitOfMeasure || '',
        quantity: m.quantity,
        unitCost,
        lossAmount: loss,
        lotCode: m.lot?.lotCode || 'N/A',
        reason: m.reason || 'Descarte por merma/vencimiento',
        userName: m.user?.name || 'Sistema',
      };
    });

    res.json({
      success: true,
      data: {
        totalLoss: Math.round(totalLoss * 100) / 100,
        totalItems: Math.round(totalItems * 100) / 100,
        totalEvents: movements.length,
        movements: formattedMovements,
      },
    });
  } catch (error) { next(error); }
};

module.exports = {
  getPriceHistory,
  getSalesSummary,
  getInventoryRotation,
  createExpense,
  getExpenses,
  getDashboard,
  getShrinkage,
};
