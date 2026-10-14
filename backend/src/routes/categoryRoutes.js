const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/rbacMiddleware');

router.use(authMiddleware);

router.get('/', categoryController.getCategories);
router.post('/', requirePermission('inventory', 'create'), categoryController.createCategory);
router.put('/:id', requirePermission('inventory', 'update'), categoryController.updateCategory);
router.delete('/:id', requirePermission('inventory', 'delete'), categoryController.deleteCategory);

module.exports = router;
