const { ROLES } = require('../utils/constants');

/**
 * Middleware de control de acceso basado en roles (RBAC)
 * Verifica si el usuario tiene el permiso requerido para el módulo y acción
 *
 * @param {string} module - Módulo requerido (ej: 'inventory', 'menu')
 * @param {string} action - Acción requerida (ej: 'create', 'read', 'update', 'delete')
 */
const requirePermission = (module, action) => {
  return (req, res, next) => {
    try {
      const { roles, permissions } = req.user;

      // Los administradores tienen acceso total
      if (roles.includes(ROLES.ADMIN)) {
        return next();
      }

      // Verificar si el usuario tiene el permiso específico
      const hasPermission = permissions.some(
        (p) => p.module === module && p.action === action
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Acceso denegado. No tiene permiso para ${action} en el módulo ${module}.`,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware que verifica si el usuario tiene alguno de los roles especificados
 *
 * @param  {...string} roles - Roles permitidos
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      const { roles } = req.user;

      const hasRole = roles.some((role) => allowedRoles.includes(role));

      if (!hasRole) {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. No tiene el rol requerido.',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { requirePermission, requireRole };
