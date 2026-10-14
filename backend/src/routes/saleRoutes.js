const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/rbacMiddleware');

router.use(authMiddleware);

router.post('/', requirePermission('sales', 'create'), saleController.createSale);
router.get('/', saleController.getSales);
router.put('/:id/cancel', requirePermission('sales', 'delete'), saleController.cancelSale);

module.exports = router;
