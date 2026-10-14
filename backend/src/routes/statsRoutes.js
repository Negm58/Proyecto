const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/rbacMiddleware');

router.use(authMiddleware);

router.get('/dashboard', statsController.getDashboard);
router.get('/price-history', statsController.getPriceHistory);
router.get('/sales-summary', statsController.getSalesSummary);
router.get('/inventory-rotation', statsController.getInventoryRotation);
router.get('/shrinkage', statsController.getShrinkage);

router.get('/expenses', statsController.getExpenses);
router.post('/expenses', requirePermission('stats', 'create'), statsController.createExpense);

module.exports = router;
