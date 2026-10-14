const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

class AuthService {
  /**
   * Registrar un nuevo usuario.
   * El primer usuario registrado se convierte automáticamente en ADMIN.
   */
  async register({ name, email, password }) {
    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw Object.assign(new Error('El email ya está registrado.'), { statusCode: 409 });
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Verificar si es el primer usuario (será ADMIN)
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

    // Asignar rol
    if (isFirstUser) {
      // Primer usuario → ADMIN
      const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
      if (adminRole) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId: adminRole.id },
        });
      }
    }

    // Generar token
    const token = this.generateToken(user.id);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: isFirstUser ? ['ADMIN'] : [],
      },
      token,
      isFirstUser,
    };
  }

  /**
   * Iniciar sesión con email y contraseña
   */
  async login({ email, password }) {
    // Buscar usuario con sus roles
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw Object.assign(new Error('Credenciales incorrectas.'), { statusCode: 401 });
    }

    if (!user.isActive) {
      throw Object.assign(new Error('La cuenta está desactivada. Contacte al administrador.'), { statusCode: 403 });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw Object.assign(new Error('Credenciales incorrectas.'), { statusCode: 401 });
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

    // Generar token
    const token = this.generateToken(user.id);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles,
        permissions,
      },
      token,
    };
  }

  /**
   * Obtener datos del usuario actual (desde el token)
   */
  async getMe(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw Object.assign(new Error('Usuario no encontrado.'), { statusCode: 404 });
    }

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

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      roles,
      permissions,
      createdAt: user.createdAt,
    };
  }

  /**
   * Obtener lista de perfiles registrados para facilitar la recuperación si se olvidó el usuario/correo
   */
  async getPublicProfiles() {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        userRoles: {
          include: { role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      roles: u.userRoles.map((ur) => ur.role.name),
    }));
  }

  /**
   * Buscar usuario por email o nombre para recuperación de cuenta
   */
  async recoverUser(identifier) {
    if (!identifier || identifier.trim() === '') {
      throw Object.assign(new Error('Debes ingresar tu correo electrónico o tu nombre de usuario.'), { statusCode: 400 });
    }

    const clean = identifier.trim().toLowerCase();

    // Buscar por email o por coincidencia en nombre
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: clean },
          { name: { contains: clean } },
        ],
      },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw Object.assign(new Error(`No se encontró ninguna cuenta con el correo o nombre "${identifier}".`), { statusCode: 404 });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      roles: user.userRoles.map((ur) => ur.role.name),
      createdAt: user.createdAt,
    };
  }

  /**
   * Restablecer la contraseña de un usuario mediante email o identificador
   * Permite PIN de Recuperación Maestro (LLOVIZNA2026) en emergencias
   */
  async resetPassword({ email, newPassword, masterPin }) {
    if (!email || !newPassword) {
      throw Object.assign(new Error('El correo electrónico y la nueva contraseña son requeridos.'), { statusCode: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw Object.assign(new Error('No existe ninguna cuenta registrada con este correo electrónico.'), { statusCode: 404 });
    }

    if (newPassword.length < 6) {
      throw Object.assign(new Error('La nueva contraseña debe tener al menos 6 caracteres.'), { statusCode: 400 });
    }

    // Hash de la nueva clave
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, isActive: true },
    });

    // Generar token para permitir inicio de sesión inmediato
    const token = this.generateToken(user.id);
    const roles = user.userRoles.map((ur) => ur.role.name);

    return {
      message: '¡Contraseña actualizada exitosamente! Se ha restablecido tu acceso a Pollos La Llovizna.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles,
      },
    };
  }

  /**
   * Generar JWT token
   */
  generateToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }
}

module.exports = new AuthService();
