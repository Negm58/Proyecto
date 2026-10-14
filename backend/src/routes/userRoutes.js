const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/rbacMiddleware');
const { ROLES } = require('../utils/constants');

// Todas las rutas de usuarios requieren autenticación y rol ADMIN
router.use(authMiddleware);

router.get('/roles', userController.getRoles);
router.get('/', requireRole(ROLES.ADMIN), userController.getUsers);
router.post('/', requireRole(ROLES.ADMIN), userController.createUser);
router.put('/:id', requireRole(ROLES.ADMIN), userController.updateUser);
router.delete('/:id', requireRole(ROLES.ADMIN), userController.deleteUser);
router.delete('/:id/permanent', requireRole(ROLES.ADMIN), userController.deleteUserPermanent);
router.put('/:id/roles', requireRole(ROLES.ADMIN), userController.assignRoles);

module.exports = router;
