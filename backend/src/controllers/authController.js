const authService = require('../services/authService');

/**
 * POST /api/auth/register
 * Registrar nuevo usuario (primer usuario = ADMIN automático)
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, email y contraseña son requeridos.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres.',
      });
    }

    const result = await authService.register({ name, email, password });

    res.status(201).json({
      success: true,
      message: result.isFirstUser
        ? '¡Bienvenido! Se ha creado tu cuenta como Administrador del sistema.'
        : 'Cuenta creada exitosamente.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Iniciar sesión
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos.',
      });
    }

    const result = await authService.login({ email, password });

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Obtener usuario autenticado actual
 */
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/profiles
 * Listar perfiles registrados para facilitar la recuperación
 */
const getPublicProfiles = async (req, res, next) => {
  try {
    const profiles = await authService.getPublicProfiles();
    res.json({
      success: true,
      data: profiles,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/recover
 * Consultar datos de cuenta por email o nombre
 */
const recoverUser = async (req, res, next) => {
  try {
    const { email, identifier } = req.body;
    const target = identifier || email;
    if (!target) {
      return res.status(400).json({
        success: false,
        message: 'Debes ingresar tu correo electrónico o tu nombre.',
      });
    }

    const user = await authService.recoverUser(target);
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password
 * Restablecer contraseña de usuario
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword, masterPin } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico y la nueva contraseña son requeridos.',
      });
    }

    const result = await authService.resetPassword({ email, newPassword, masterPin });
    res.json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, recoverUser, resetPassword, getPublicProfiles };
