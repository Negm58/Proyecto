const prisma = require('../config/database');

// GET /api/categories
const getCategories = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (error) { next(error); }
};

// POST /api/categories
const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'El nombre es requerido.' });
    const category = await prisma.category.create({ data: { name, description } });
    res.status(201).json({ success: true, data: category });
  } catch (error) { next(error); }
};

// PUT /api/categories/:id
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const category = await prisma.category.update({ where: { id: parseInt(id) }, data: { name, description } });
    res.json({ success: true, data: category });
  } catch (error) { next(error); }
};

// DELETE /api/categories/:id
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.category.delete({ where: { id: parseInt(id) } });
    res.json({ success: true, message: 'Categoría eliminada.' });
  } catch (error) { next(error); }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
