const prisma = require('../config/database');

// GET /api/products
const getProducts = async (req, res, next) => {
  try {
    const { categoryId, search, active } = req.query;
    const where = {};
    if (categoryId) where.categoryId = parseInt(categoryId);
    if (active !== undefined) {
      where.isActive = active === 'true';
    } else {
      where.isActive = true; // Por defecto solo insumos activos en el inventario
    }
    if (search) where.name = { contains: search };

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        productSuppliers: { include: { supplier: { select: { name: true } } } },
        inventoryLots: {
          where: { quantityRemaining: { gt: 0 } },
          select: { id: true, quantityRemaining: true, expirationDate: true, lotCode: true, purchasePrice: true, status: true },
          orderBy: { expirationDate: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const now = new Date();

    const productsWithStock = products.map((p) => {
      const activeLots = p.inventoryLots.filter((l) => l.status === 'ACTIVE' && l.quantityRemaining > 0);
      const stock = Math.round(activeLots.reduce((sum, lot) => sum + lot.quantityRemaining, 0) * 1000) / 1000;

      // Buscar lote con vencimiento más próximo
      const lotsWithDates = activeLots
        .filter((l) => l.expirationDate)
        .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));

      const nearestLot = lotsWithDates.length > 0 ? lotsWithDates[0] : null;
      const nearestExpiry = nearestLot ? nearestLot.expirationDate : null;

      let daysUntilExpiry = null;
      let expiryStatus = 'NO_EXPIRY'; // NO_EXPIRY, OK, WARNING, CRITICAL, EXPIRED

      if (nearestExpiry) {
        const diffMs = new Date(nearestExpiry).getTime() - now.getTime();
        daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
          expiryStatus = 'EXPIRED';
        } else if (daysUntilExpiry <= 3) {
          expiryStatus = 'CRITICAL';
        } else if (daysUntilExpiry <= 7) {
          expiryStatus = 'WARNING';
        } else {
          expiryStatus = 'OK';
        }
      }

      const expiredLotsCount = p.inventoryLots.filter(
        (l) => (l.status === 'EXPIRED' || (l.expirationDate && new Date(l.expirationDate) < now)) && l.quantityRemaining > 0
      ).length;

      return {
        ...p,
        totalStock: stock,
        currentStock: stock,
        nearestExpiry,
        daysUntilExpiry,
        expiryStatus,
        activeLotsCount: activeLots.length,
        expiredLotsCount,
        inventoryLots: undefined,
      };
    });

    res.json({ success: true, data: productsWithStock });
  } catch (error) { next(error); }
};

// GET /api/products/:id
const getProduct = async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        category: true,
        productSuppliers: { include: { supplier: true } },
        inventoryLots: { where: { status: 'ACTIVE' }, orderBy: { entryDate: 'asc' } },
        priceHistory: { orderBy: { recordedAt: 'desc' }, take: 20 },
      },
    });
    if (!product) return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    res.json({ success: true, data: product });
  } catch (error) { next(error); }
};

// POST /api/products
const createProduct = async (req, res, next) => {
  try {
    const { name, description, categoryId, unitOfMeasure, currentPrice, minStockThreshold } = req.body;
    if (!name || !unitOfMeasure) {
      return res.status(400).json({ success: false, message: 'Nombre y unidad de medida son requeridos.' });
    }
    const product = await prisma.product.create({
      data: {
        name, description,
        categoryId: categoryId ? parseInt(categoryId) : null,
        unitOfMeasure,
        currentPrice: parseFloat(currentPrice) || 0,
        minStockThreshold: parseFloat(minStockThreshold) || 0,
      },
      include: { category: true },
    });

    const io = req.app.get('io');
    if (io) io.emit('product:created', product);

    res.status(201).json({ success: true, data: product });
  } catch (error) { next(error); }
};

// PUT /api/products/:id
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, categoryId, unitOfMeasure, currentPrice, minStockThreshold, isActive } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (categoryId !== undefined) updateData.categoryId = categoryId ? parseInt(categoryId) : null;
    if (unitOfMeasure !== undefined) updateData.unitOfMeasure = unitOfMeasure;
    if (minStockThreshold !== undefined) updateData.minStockThreshold = parseFloat(minStockThreshold);
    if (isActive !== undefined) updateData.isActive = isActive;

    // Si cambió el precio, registrar historial
    if (currentPrice !== undefined) {
      const currentProduct = await prisma.product.findUnique({ where: { id: parseInt(id) } });
      if (currentProduct && parseFloat(currentPrice) !== currentProduct.currentPrice) {
        await prisma.priceHistory.create({
          data: {
            productId: parseInt(id),
            oldPrice: currentProduct.currentPrice,
            newPrice: parseFloat(currentPrice),
          },
        });
      }
      updateData.currentPrice = parseFloat(currentPrice);
    }

    const product = await prisma.product.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: { category: true },
    });

    const io = req.app.get('io');
    if (io) io.emit('product:updated', product);

    res.json({ success: true, data: product });
  } catch (error) { next(error); }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        recipeItems: true,
        inventoryLots: true,
        inventoryMovements: true,
      },
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    }

    const hasDependencies = (product.recipeItems && product.recipeItems.length > 0) ||
      (product.inventoryLots && product.inventoryLots.length > 0) ||
      (product.inventoryMovements && product.inventoryMovements.length > 0);

    if (hasDependencies) {
      // Si tiene recetas o lotes asociados, desactivar suavemente para no romper histórico
      await prisma.product.update({
        where: { id: productId },
        data: { isActive: false },
      });
    } else {
      // Si no tiene dependencias, eliminar definitivamente de la BD
      await prisma.productSupplier.deleteMany({ where: { productId } });
      await prisma.priceHistory.deleteMany({ where: { productId } });
      await prisma.alert.deleteMany({ where: { productId } });
      await prisma.product.delete({ where: { id: productId } });
    }

    const io = req.app.get('io');
    if (io) io.emit('product:deleted', { id: productId, name: product.name });

    res.json({
      success: true,
      message: hasDependencies
        ? `El insumo "${product.name}" ha sido desactivado del inventario.`
        : `El insumo "${product.name}" ha sido eliminado exitosamente.`,
    });
  } catch (error) { next(error); }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct };
