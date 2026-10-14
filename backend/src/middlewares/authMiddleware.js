const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

/**
 * Middleware de autenticación JWT
 * Verifica el token y adjunta el usuario al request
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acceso denegado. No se proporcionó token de autenticación.',
      });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado o desactivado.',
      });
    }

    // Extraer roles y permisos
    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = [];
    user.userRoles.forEach((ur) => {
      ur.role.rolePermissions.forEach((rp) => {
        permissions.push({
          module: rp.permission.module,
          action: rp.permission.action,
        });
      });
    });

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      roles,
      permissions,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido.',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado. Por favor, inicie sesión nuevamente.',
      });
    }
    next(error);
  }
};

module.exports = { authMiddleware };
