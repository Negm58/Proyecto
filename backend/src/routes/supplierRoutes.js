const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/rbacMiddleware');

router.use(authMiddleware);

router.get('/', supplierController.getSuppliers);
router.post('/', requirePermission('inventory', 'create'), supplierController.createSupplier);
router.put('/:id', requirePermission('inventory', 'update'), supplierController.updateSupplier);
router.delete('/:id', requirePermission('inventory', 'delete'), supplierController.deleteSupplier);

module.exports = router;
