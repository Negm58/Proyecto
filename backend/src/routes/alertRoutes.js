const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', alertController.getAlerts);
router.put('/:id/read', alertController.markAsRead);
router.put('/mark-all-read', alertController.markAllAsRead);
router.delete('/:id', alertController.deleteAlert);

module.exports = router;
