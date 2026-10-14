const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Rutas públicas
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profiles', authController.getPublicProfiles);
router.post('/recover', authController.recoverUser);
router.post('/reset-password', authController.resetPassword);

// Rutas protegidas
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
