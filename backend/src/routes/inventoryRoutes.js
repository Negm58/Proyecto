const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/rbacMiddleware');

router.use(authMiddleware);

router.post('/lots', requirePermission('inventory', 'create'), inventoryController.registerLot);
router.get('/lots', inventoryController.getLots);
router.get('/summary', inventoryController.getSummary);
router.get('/movements', inventoryController.getMovements);
router.get('/stock/:productId', inventoryController.getProductStock);

// Rutas de caducidad y descarte de productos vencidos (mermas)
router.post('/check-expirations', inventoryController.checkExpirationsNow);
router.get('/expired-lots', inventoryController.getExpiredLots);
router.post('/lots/:id/discard', requirePermission('inventory', 'delete'), inventoryController.discardLot);
router.post('/discard-expired-all', requirePermission('inventory', 'delete'), inventoryController.discardAllExpired);

module.exports = router;
