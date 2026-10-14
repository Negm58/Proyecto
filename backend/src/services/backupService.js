const prisma = require('../config/database');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../../backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

class BackupService {
  /**
   * Ejecuta un respaldo completo de todas las tablas de la base de datos a un archivo JSON comprimible.
   */
  async createBackup({ userId = null, backupType = 'MANUAL' } = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-inventario-${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    try {
      // Exportar datos de todas las entidades
      const [
        users,
        roles,
        permissions,
        userRoles,
        rolePermissions,
        categories,
        suppliers,
        products,
        inventoryLots,
        menuItems,
        recipeItems,
        comboItems,
        sales,
        saleItems,
        inventoryMovements,
        priceHistory,
        operationalExpenses,
        alerts,
      ] = await Promise.all([
        prisma.user.findMany(), // Incluye passwordHash para permitir restaurar credenciales
        prisma.role.findMany(),
        prisma.permission.findMany(),
        prisma.userRole.findMany(),
        prisma.rolePermission.findMany(),
        prisma.category.findMany(),
        prisma.supplier.findMany(),
        prisma.product.findMany(),
        prisma.inventoryLot.findMany(),
        prisma.menuItem.findMany(),
        prisma.recipeItem.findMany(),
        prisma.comboItem.findMany(),
        prisma.sale.findMany(),
        prisma.saleItem.findMany(),
        prisma.inventoryMovements ? prisma.inventoryMovements.findMany() : prisma.inventoryMovement.findMany(),
        prisma.priceHistory.findMany(),
        prisma.operationalExpense.findMany(),
        prisma.alert.findMany(),
      ]);

      const combos = menuItems.filter((m) => m.type === 'COMBO');

      const backupData = {
        metadata: {
          system: 'Sistema de Inventario - Pollos La Llovizna',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          type: backupType,
          totalRecords: {
            products: products.length,
            lots: inventoryLots.length,
            menuItems: menuItems.length,
            sales: sales.length,
          },
        },
        data: {
          users,
          roles,
          permissions,
          userRoles,
          rolePermissions,
          categories,
          suppliers,
          products,
          inventoryLots,
          menuItems,
          recipeItems,
          combos,
          comboItems,
          sales,
          saleItems,
          inventoryMovements,
          priceHistory,
          operationalExpenses,
          alerts,
        },
      };

      fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf-8');
      const sizeBytes = fs.statSync(filepath).size;
      const formattedSize = `${(sizeBytes / 1024).toFixed(1)} KB`;

      // Obtener un userId válido para el registro en BD (si es automático, usar un admin)
      let targetUserId = userId;
      if (!targetUserId) {
        const adminUser = await prisma.user.findFirst({
          where: { userRoles: { some: { role: { name: 'ADMIN' } } } },
          select: { id: true },
        });
        targetUserId = adminUser ? adminUser.id : (await prisma.user.findFirst({ select: { id: true } }))?.id;
      }

      let log = null;
      if (targetUserId) {
        log = await prisma.backupLog.create({
          data: {
            userId: targetUserId,
            backupType,
            filePath: filepath,
            fileSize: formattedSize,
            status: 'SUCCESS',
          },
        });
      }

      return {
        id: log ? log.id : Date.now(),
        filename,
        filepath,
        sizeBytes,
        fileSize: formattedSize,
        createdAt: log ? log.createdAt : new Date(),
      };
    } catch (error) {
      console.error('Error al generar respaldo:', error);
      let errUserId = userId;
      if (!errUserId) {
        const anyUser = await prisma.user.findFirst({ select: { id: true } });
        errUserId = anyUser?.id;
      }
      if (errUserId) {
        await prisma.backupLog.create({
          data: {
            userId: errUserId,
            backupType,
            filePath: filepath,
            status: 'FAILED',
          },
        }).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Obtener registros de backups
   */
  async getBackupLogs() {
    return prisma.backupLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Obtener ruta de archivo para descarga
   */
  async getBackupFile(id) {
    const log = await prisma.backupLog.findUnique({
      where: { id: parseInt(id) },
    });
    if (!log || !fs.existsSync(log.filePath)) {
      throw new Error('Archivo de respaldo no encontrado en el servidor.');
    }
    return {
      filePath: log.filePath,
      filename: path.basename(log.filePath),
    };
  }

  /**
   * Cargar y restaurar base de datos a partir de un respaldo específico por ID
   */
  async restoreBackup(backupLogId, userId = null) {
    const log = await prisma.backupLog.findUnique({
      where: { id: parseInt(backupLogId) },
    });
    if (!log || !log.filePath || !fs.existsSync(log.filePath)) {
      throw new Error(`El archivo de respaldo #${backupLogId} no se encuentra en el servidor.`);
    }

    const raw = fs.readFileSync(log.filePath, 'utf-8');
    const backupData = JSON.parse(raw);
    return this.restoreFromData(backupData, userId, `Restauración desde respaldo #${backupLogId}`);
  }

  /**
   * Restaurar base de datos a partir de un objeto de respaldo JSON
   */
  async restoreFromData(backupData, userId = null, note = 'Restauración manual de respaldo') {
    if (!backupData || !backupData.data) {
      throw new Error('Estructura de respaldo inválida. El archivo debe contener la clave "data".');
    }

    const d = backupData.data;
    const restoredCounts = {};

    try {
      // 1. Roles
      if (Array.isArray(d.roles) && d.roles.length > 0) {
        for (const item of d.roles) {
          await prisma.role.upsert({
            where: { id: item.id },
            update: { name: item.name, description: item.description },
            create: { id: item.id, name: item.name, description: item.description },
          });
        }
        restoredCounts.roles = d.roles.length;
      }

      // 2. Permisos
      if (Array.isArray(d.permissions) && d.permissions.length > 0) {
        for (const item of d.permissions) {
          await prisma.permission.upsert({
            where: { id: item.id },
            update: { module: item.module, action: item.action, description: item.description },
            create: { id: item.id, module: item.module, action: item.action, description: item.description },
          });
        }
        restoredCounts.permissions = d.permissions.length;
      }

      // 3. Categorías
      if (Array.isArray(d.categories) && d.categories.length > 0) {
        for (const item of d.categories) {
          await prisma.category.upsert({
            where: { id: item.id },
            update: { name: item.name, description: item.description },
            create: { id: item.id, name: item.name, description: item.description },
          });
        }
        restoredCounts.categories = d.categories.length;
      }

      // 4. Proveedores
      if (Array.isArray(d.suppliers) && d.suppliers.length > 0) {
        for (const item of d.suppliers) {
          await prisma.supplier.upsert({
            where: { id: item.id },
            update: {
              name: item.name,
              contactPhone: item.contactPhone,
              contactEmail: item.contactEmail,
              address: item.address,
              isActive: item.isActive ?? true,
            },
            create: {
              id: item.id,
              name: item.name,
              contactPhone: item.contactPhone,
              contactEmail: item.contactEmail,
              address: item.address,
              isActive: item.isActive ?? true,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            },
          });
        }
        restoredCounts.suppliers = d.suppliers.length;
      }

      // 5. Insumos / Productos
      if (Array.isArray(d.products) && d.products.length > 0) {
        for (const item of d.products) {
          await prisma.product.upsert({
            where: { id: item.id },
            update: {
              name: item.name,
              description: item.description,
              categoryId: item.categoryId,
              unitOfMeasure: item.unitOfMeasure,
              currentPrice: item.currentPrice,
              minStockThreshold: item.minStockThreshold,
              isActive: item.isActive ?? true,
            },
            create: {
              id: item.id,
              name: item.name,
              description: item.description,
              categoryId: item.categoryId,
              unitOfMeasure: item.unitOfMeasure,
              currentPrice: item.currentPrice,
              minStockThreshold: item.minStockThreshold,
              isActive: item.isActive ?? true,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            },
          });
        }
        restoredCounts.products = d.products.length;
      }

      // 6. Usuarios
      if (Array.isArray(d.users) && d.users.length > 0) {
        for (const item of d.users) {
          await prisma.user.upsert({
            where: { id: item.id },
            update: {
              name: item.name,
              email: item.email,
              passwordHash: item.passwordHash || '$2a$12$NqFzI.Ua9775lI1388iP2e5eR0YmB7O5.rFz283p2P.r9f.y1Oxe2',
              isActive: item.isActive ?? true,
            },
            create: {
              id: item.id,
              name: item.name,
              email: item.email,
              passwordHash: item.passwordHash || '$2a$12$NqFzI.Ua9775lI1388iP2e5eR0YmB7O5.rFz283p2P.r9f.y1Oxe2',
              isActive: item.isActive ?? true,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            },
          });
        }
        restoredCounts.users = d.users.length;
      }

      // 7. UserRoles
      if (Array.isArray(d.userRoles) && d.userRoles.length > 0) {
        for (const item of d.userRoles) {
          await prisma.userRole.upsert({
            where: { userId_roleId: { userId: item.userId, roleId: item.roleId } },
            update: {},
            create: { userId: item.userId, roleId: item.roleId },
          });
        }
      }

      // 8. Lotes de inventario (InventoryLot)
      if (Array.isArray(d.inventoryLots) && d.inventoryLots.length > 0) {
        for (const item of d.inventoryLots) {
          await prisma.inventoryLot.upsert({
            where: { id: item.id },
            update: {
              productId: item.productId,
              supplierId: item.supplierId,
              quantityInitial: item.quantityInitial,
              quantityRemaining: item.quantityRemaining,
              purchasePrice: item.purchasePrice,
              expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
              lotCode: item.lotCode,
              status: item.status,
            },
            create: {
              id: item.id,
              productId: item.productId,
              supplierId: item.supplierId,
              quantityInitial: item.quantityInitial,
              quantityRemaining: item.quantityRemaining,
              purchasePrice: item.purchasePrice,
              entryDate: item.entryDate ? new Date(item.entryDate) : new Date(),
              expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
              lotCode: item.lotCode,
              status: item.status,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            },
          });
        }
        restoredCounts.lots = d.inventoryLots.length;
      }

      // 9. Platos del Menú (MenuItem)
      if (Array.isArray(d.menuItems) && d.menuItems.length > 0) {
        for (const item of d.menuItems) {
          await prisma.menuItem.upsert({
            where: { id: item.id },
            update: {
              name: item.name,
              description: item.description,
              type: item.type,
              productionCost: item.productionCost,
              suggestedPrice: item.suggestedPrice,
              salePrice: item.salePrice,
              profitMarginPct: item.profitMarginPct,
              imageUrl: item.imageUrl,
              isActive: item.isActive ?? true,
            },
            create: {
              id: item.id,
              name: item.name,
              description: item.description,
              type: item.type,
              productionCost: item.productionCost,
              suggestedPrice: item.suggestedPrice,
              salePrice: item.salePrice,
              profitMarginPct: item.profitMarginPct,
              imageUrl: item.imageUrl,
              isActive: item.isActive ?? true,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            },
          });
        }
        restoredCounts.menuItems = d.menuItems.length;
      }

      // 10. Recetas (RecipeItem)
      if (Array.isArray(d.recipeItems) && d.recipeItems.length > 0) {
        for (const item of d.recipeItems) {
          await prisma.recipeItem.upsert({
            where: { menuItemId_productId: { menuItemId: item.menuItemId, productId: item.productId } },
            update: { quantityNeeded: item.quantityNeeded, unitOfMeasure: item.unitOfMeasure },
            create: {
              menuItemId: item.menuItemId,
              productId: item.productId,
              quantityNeeded: item.quantityNeeded,
              unitOfMeasure: item.unitOfMeasure,
            },
          });
        }
      }

      // 11. Combos (ComboItem)
      if (Array.isArray(d.comboItems) && d.comboItems.length > 0) {
        for (const item of d.comboItems) {
          await prisma.comboItem.upsert({
            where: { id: item.id },
            update: { comboId: item.comboId, menuItemId: item.menuItemId, quantity: item.quantity },
            create: {
              id: item.id,
              comboId: item.comboId,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
            },
          });
        }
      }

      // 12. Ventas (Sale y SaleItem)
      if (Array.isArray(d.sales) && d.sales.length > 0) {
        for (const item of d.sales) {
          await prisma.sale.upsert({
            where: { id: item.id },
            update: {
              userId: item.userId,
              totalAmount: item.totalAmount,
              totalCost: item.totalCost,
              paymentMethod: item.paymentMethod,
              status: item.status,
            },
            create: {
              id: item.id,
              userId: item.userId,
              totalAmount: item.totalAmount,
              totalCost: item.totalCost,
              paymentMethod: item.paymentMethod,
              status: item.status,
              saleDate: item.saleDate ? new Date(item.saleDate) : new Date(),
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            },
          });
        }
        restoredCounts.sales = d.sales.length;
      }

      if (Array.isArray(d.saleItems) && d.saleItems.length > 0) {
        for (const item of d.saleItems) {
          await prisma.saleItem.upsert({
            where: { id: item.id },
            update: {
              saleId: item.saleId,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            },
            create: {
              id: item.id,
              saleId: item.saleId,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            },
          });
        }
      }

      // 13. Movimientos de inventario
      if (Array.isArray(d.inventoryMovements) && d.inventoryMovements.length > 0) {
        for (const item of d.inventoryMovements) {
          await prisma.inventoryMovement.upsert({
            where: { id: item.id },
            update: {
              productId: item.productId,
              lotId: item.lotId,
              userId: item.userId,
              movementType: item.movementType,
              quantity: item.quantity,
              reason: item.reason,
            },
            create: {
              id: item.id,
              productId: item.productId,
              lotId: item.lotId,
              userId: item.userId,
              movementType: item.movementType,
              quantity: item.quantity,
              reason: item.reason,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            },
          });
        }
      }

      // 14. Gastos operativos
      if (Array.isArray(d.operationalExpenses) && d.operationalExpenses.length > 0) {
        for (const item of d.operationalExpenses) {
          await prisma.operationalExpense.upsert({
            where: { id: item.id },
            update: {
              userId: item.userId,
              category: item.category,
              description: item.description,
              amount: item.amount,
            },
            create: {
              id: item.id,
              userId: item.userId,
              category: item.category,
              description: item.description,
              amount: item.amount,
              expenseDate: item.expenseDate ? new Date(item.expenseDate) : new Date(),
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            },
          });
        }
      }

      // Registrar log de restauración
      let restoreUserId = userId;
      if (!restoreUserId) {
        const adminUser = await prisma.user.findFirst({ select: { id: true } });
        restoreUserId = adminUser?.id;
      }

      if (restoreUserId) {
        await prisma.backupLog.create({
          data: {
            userId: restoreUserId,
            backupType: 'RESTORE',
            status: 'SUCCESS',
            fileSize: `${Object.values(restoredCounts).reduce((a, b) => a + b, 0)} registros`,
          },
        });
      }

      return {
        success: true,
        message: 'Copia de seguridad cargada y restaurada exitosamente en la base de datos.',
        restoredCounts,
      };
    } catch (err) {
      console.error('Error durante la restauración del respaldo:', err);
      throw new Error(`Fallo al restaurar respaldo: ${err.message}`);
    }
  }
}

module.exports = new BackupService();
