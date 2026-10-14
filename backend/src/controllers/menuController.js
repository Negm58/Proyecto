const prisma = require('../config/database');
const menuService = require('../services/menuService');

// Normaliza: el contenido de un combo vive en la relación `comboParent`; se expone como `comboItems`
const mapCombo = (item) => {
  if (!item) return item;
  const { comboParent, comboItems, ...rest } = item;
  return { ...rest, comboItems: comboParent || [] };
};

// GET /api/menu/items
const getMenuItems = async (req, res, next) => {
  try {
    const { type, active } = req.query;
    const where = { isActive: active !== undefined ? active === 'true' : true };
    if (type) where.type = type;

    const items = await prisma.menuItem.findMany({
      where,
      include: {
        recipeItems: { include: { product: { select: { id: true, name: true, unitOfMeasure: true, currentPrice: true } } } },
        comboParent: { include: { menuItem: { select: { id: true, name: true, salePrice: true, productionCost: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: items.map(mapCombo) });
  } catch (error) { next(error); }
};

// GET /api/menu/items/:id
const getMenuItem = async (req, res, next) => {
  try {
    const item = await prisma.menuItem.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        recipeItems: { include: { product: true } },
        comboParent: { include: { menuItem: true } },
      },
    });
    if (!item) return res.status(404).json({ success: false, message: 'Plato no encontrado.' });
    res.json({ success: true, data: mapCombo(item) });
  } catch (error) { next(error); }
};

// POST /api/menu/items
const createMenuItem = async (req, res, next) => {
  try {
    const { name, description, type, salePrice, profitMarginPct, imageUrl, recipe } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'Nombre y tipo son requeridos.' });
    }
    const item = await menuService.createMenuItem({
      name, description, type,
      salePrice: salePrice ? parseFloat(salePrice) : null,
      profitMarginPct: profitMarginPct ? parseFloat(profitMarginPct) : null,
      imageUrl, recipe,
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) { next(error); }
};

// PUT /api/menu/items/:id
const updateMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await menuService.updateMenuItem(parseInt(id), req.body);
    res.json({ success: true, data: mapCombo(item) });
  } catch (error) { next(error); }
};

// DELETE /api/menu/items/:id
const deleteMenuItem = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Plato o combo no encontrado.' });
    }

    // Verificar si tiene historial de ventas asociadas
    const salesCount = await prisma.saleItem.count({ where: { menuItemId: id } });

    if (salesCount > 0) {
      // Soft-delete para conservar el histórico de ventas
      await prisma.menuItem.update({ where: { id }, data: { isActive: false } });
    } else {
      // Hard-delete si no tiene ventas
      await prisma.comboItem.deleteMany({ where: { OR: [{ comboId: id }, { menuItemId: id }] } });
      await prisma.recipeItem.deleteMany({ where: { menuItemId: id } });
      await prisma.menuItem.delete({ where: { id } });
    }

    const io = req.app.get('io');
    if (io) io.emit('menu:deleted', { id, name: item.name });

    res.json({
      success: true,
      message: salesCount > 0
        ? `"${item.name}" fue desactivado del menú (conserva historial de ventas).`
        : `"${item.name}" fue eliminado permanentemente del menú.`,
    });
  } catch (error) { next(error); }
};

// POST /api/menu/items/:id/validate-price
const validatePrice = async (req, res, next) => {
  try {
    const { salePrice } = req.body;
    const item = await prisma.menuItem.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!item) return res.status(404).json({ success: false, message: 'Plato no encontrado.' });

    const validation = menuService.validateProfitMargin(
      parseFloat(salePrice),
      item.productionCost,
      30
    );
    res.json({ success: true, data: validation });
  } catch (error) { next(error); }
};

// POST /api/menu/recalculate-costs
const recalculateCosts = async (req, res, next) => {
  try {
    const result = await menuService.recalculateAllCosts();
    res.json({ success: true, message: `Se recalcularon ${result.updated} de ${result.total} platos.`, data: result });
  } catch (error) { next(error); }
};

// POST /api/menu/combos
const createCombo = async (req, res, next) => {
  try {
    const { name, description, salePrice, profitMarginPct, imageUrl, items, comboItems } = req.body;
    const comboItemsInput = items || comboItems;
    if (!name || !comboItemsInput || comboItemsInput.length === 0) {
      return res.status(400).json({ success: false, message: 'Nombre e items del combo son requeridos.' });
    }

    const cleanItems = comboItemsInput
      .filter((ci) => ci.menuItemId)
      .map((ci) => ({ menuItemId: parseInt(ci.menuItemId), quantity: parseInt(ci.quantity) || 1 }));

    // Calcular costo total del combo sumando los costos de producción de cada plato
    const children = await prisma.menuItem.findMany({
      where: { id: { in: cleanItems.map((c) => c.menuItemId) }, isActive: true },
    });
    const missing = cleanItems.filter((c) => !children.find((x) => x.id === c.menuItemId));
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: 'Uno o más platos seleccionados no existen o están inactivos.' });
    }
    const totalCost = Math.round(
      cleanItems.reduce((s, c) => s + children.find((x) => x.id === c.menuItemId).productionCost * c.quantity, 0) * 100
    ) / 100;

    const pricing = menuService.resolvePricing(totalCost, salePrice, profitMarginPct);

    const created = await prisma.$transaction(async (tx) => {
      const combo = await tx.menuItem.create({
        data: { name, description, type: 'COMBO', productionCost: totalCost, ...pricing, imageUrl },
      });
      await tx.comboItem.createMany({ data: cleanItems.map((c) => ({ comboId: combo.id, ...c })) });
      return combo;
    });

    const result = await prisma.menuItem.findUnique({
      where: { id: created.id },
      include: { comboParent: { include: { menuItem: true } } },
    });

    res.status(201).json({ success: true, data: mapCombo(result) });
  } catch (error) { next(error); }
};

module.exports = { getMenuItems, getMenuItem, createMenuItem, updateMenuItem, deleteMenuItem, validatePrice, recalculateCosts, createCombo };
