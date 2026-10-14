const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/rbacMiddleware');

router.use(authMiddleware);

router.get('/items', menuController.getMenuItems);
router.get('/items/:id', menuController.getMenuItem);
router.post('/items', requirePermission('menu', 'create'), menuController.createMenuItem);
router.put('/items/:id', requirePermission('menu', 'update'), menuController.updateMenuItem);
router.delete('/items/:id', requirePermission('menu', 'delete'), menuController.deleteMenuItem);

router.post('/combos', requirePermission('menu', 'create'), menuController.createCombo);
router.post('/items/:id/validate-price', menuController.validatePrice);
router.post('/recalculate-costs', requirePermission('menu', 'update'), menuController.recalculateCosts);

module.exports = router;
