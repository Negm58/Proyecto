const prisma = require('../config/database');

// GET /api/suppliers
const getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: { _count: { select: { productSuppliers: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: suppliers });
  } catch (error) { next(error); }
};

// POST /api/suppliers
const createSupplier = async (req, res, next) => {
  try {
    const { name, contactPhone, contactEmail, address } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'El nombre es requerido.' });
    const supplier = await prisma.supplier.create({ data: { name, contactPhone, contactEmail, address } });
    res.status(201).json({ success: true, data: supplier });
  } catch (error) { next(error); }
};

// PUT /api/suppliers/:id
const updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, contactPhone, contactEmail, address, isActive } = req.body;
    const supplier = await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: { name, contactPhone, contactEmail, address, isActive },
    });
    res.json({ success: true, data: supplier });
  } catch (error) { next(error); }
};

// DELETE /api/suppliers/:id
const deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.supplier.update({ where: { id: parseInt(id) }, data: { isActive: false } });
    res.json({ success: true, message: 'Proveedor desactivado.' });
  } catch (error) { next(error); }
};

module.exports = { getSuppliers, createSupplier, updateSupplier, deleteSupplier };
