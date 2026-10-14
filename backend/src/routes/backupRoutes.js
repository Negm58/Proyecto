const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/rbacMiddleware');
const { ROLES } = require('../utils/constants');

// Solo administradores pueden gestionar copias de seguridad
router.use(authMiddleware);
router.use(requireRole(ROLES.ADMIN));

router.post('/execute', backupController.executeBackup);
router.get('/logs', backupController.getLogs);
router.get('/download/:id', backupController.downloadBackup);
router.post('/restore/:id', backupController.restoreBackup);
router.post('/restore-file', backupController.restoreFromFile);

module.exports = router;
