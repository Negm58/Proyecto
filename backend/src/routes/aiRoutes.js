const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.post('/chat', aiController.chat);
router.get('/history', aiController.getHistory);
router.delete('/history', aiController.clearHistory);
router.get('/status', aiController.getStatus);
router.post('/config', aiController.saveConfig);

module.exports = router;
