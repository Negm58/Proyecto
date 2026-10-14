const prisma = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * GET /api/users
 * Listar todos los usuarios (con roles)
 */
const getUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          include: { role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedUsers = users.map((u) => ({
      ...u,
      roles: u.userRoles.map((ur) => ur.role.name),
      userRoles: undefined,
    }));

    res.json({ success: true, data: formattedUsers });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users
 * Crear un nuevo usuario (solo admin)
 */
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, roleIds } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, email y contraseña son requeridos.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        userRoles: roleIds && roleIds.length > 0 ? {
          create: roleIds.map((roleId) => ({ roleId })),
        } : undefined,
      },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente.',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        roles: user.userRoles.map((ur) => ur.role.name),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/:id
 * Actualizar usuario
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, password, isActive } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12);
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/:id
 * Desactivar usuario (soft delete)
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // No permitir desactivarse a sí mismo
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puede desactivar su propia cuenta.',
      });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Usuario desactivado exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/:id/permanent
 * Eliminar usuario permanentemente (solo administrador)
 */
const deleteUserPermanent = async (req, res, next) => {
  try {
    const { id } = req.params;

    // No permitir eliminarse a sí mismo
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puede eliminar su propia cuenta de administrador.',
      });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'El usuario especificado no existe.',
      });
    }

    // Reasignar registros que puedan tener clave foránea hacia este usuario
    // para mantener la integridad histórica sin violar restricciones de FK
    await prisma.sale.updateMany({ where: { userId: id }, data: { userId: req.user.id } });
    await prisma.inventoryMovement.updateMany({ where: { userId: id }, data: { userId: req.user.id } });
    await prisma.operationalExpense.updateMany({ where: { userId: id }, data: { userId: req.user.id } });
    await prisma.backupLog.updateMany({ where: { userId: id }, data: { userId: req.user.id } });
    await prisma.aiChatHistory.deleteMany({ where: { userId: id } });
    await prisma.userRole.deleteMany({ where: { userId: id } });

    // Eliminar definitivamente de la tabla users
    await prisma.user.delete({ where: { id } });

    res.json({
      success: true,
      message: `El usuario "${targetUser.name}" (${targetUser.email}) fue eliminado permanentemente de la base de datos.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/:id/roles
 * Asignar roles a un usuario
 */
const assignRoles = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { roleIds } = req.body;

    if (!roleIds || !Array.isArray(roleIds)) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de roleIds.',
      });
    }

    // Eliminar roles actuales
    await prisma.userRole.deleteMany({ where: { userId: id } });

    // Asignar nuevos roles
    await prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId: id, roleId })),
    });

    // Obtener usuario actualizado
    const user = await prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });

    res.json({
      success: true,
      message: 'Roles asignados exitosamente.',
      data: {
        id: user.id,
        name: user.name,
        roles: user.userRoles.map((ur) => ur.role.name),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/roles
 * Obtener todos los roles disponibles
 */
const getRoles = async (req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    res.json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser, deleteUserPermanent, assignRoles, getRoles };
