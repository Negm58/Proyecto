const saleService = require('../services/saleService');

// POST /api/sales
const createSale = async (req, res, next) => {
  try {
    const { items, paymentMethod } = req.body;
    const sale = await saleService.createSale({
      userId: req.user.id,
      items,
      paymentMethod,
    });

    const io = req.app.get('io');
    if (io) io.emit('sale:created', sale);

    res.status(201).json({ success: true, message: 'Venta registrada exitosamente.', data: sale });
  } catch (error) { next(error); }
};

// GET /api/sales
const getSales = async (req, res, next) => {
  try {
    const { page, limit, startDate, endDate, status } = req.query;
    const result = await saleService.getSales({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      startDate, endDate, status,
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

// PUT /api/sales/:id/cancel
const cancelSale = async (req, res, next) => {
  try {
    const sale = await saleService.cancelSale(parseInt(req.params.id));
    res.json({ success: true, message: 'Venta cancelada.', data: sale });
  } catch (error) { next(error); }
};

module.exports = { createSale, getSales, cancelSale };
