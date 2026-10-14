const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/rbacMiddleware');

router.use(authMiddleware);

router.get('/', productController.getProducts);
router.get('/:id', productController.getProduct);
router.post('/', requirePermission('inventory', 'create'), productController.createProduct);
router.put('/:id', requirePermission('inventory', 'update'), productController.updateProduct);
router.delete('/:id', requirePermission('inventory', 'delete'), productController.deleteProduct);

module.exports = router;
