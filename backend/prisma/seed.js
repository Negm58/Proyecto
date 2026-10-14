const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed completo de datos para Pollos La Llovizna...\n');

  // ==========================================
  // 1. Roles
  // ==========================================
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Administrador con acceso total al sistema' },
    }),
    prisma.role.upsert({
      where: { name: 'GERENTE' },
      update: {},
      create: { name: 'GERENTE', description: 'Gerente con acceso a inventario, menú, estadísticas y ventas' },
    }),
    prisma.role.upsert({
      where: { name: 'CAJERO' },
      update: {},
      create: { name: 'CAJERO', description: 'Cajero con acceso a ventas y consulta de menú' },
    }),
    prisma.role.upsert({
      where: { name: 'VISUALIZADOR' },
      update: {},
      create: { name: 'VISUALIZADOR', description: 'Solo lectura en todos los módulos' },
    }),
  ]);
  console.log('✅ Roles creados:', roles.map((r) => r.name).join(', '));

  // ==========================================
  // 2. Permisos por Módulo
  // ==========================================
  const modules = ['inventory', 'menu', 'stats', 'users', 'backups', 'ai', 'sales'];
  const actions = ['create', 'read', 'update', 'delete'];

  const permissions = [];
  for (const mod of modules) {
    for (const action of actions) {
      const perm = await prisma.permission.upsert({
        where: { module_action: { module: mod, action: action } },
        update: {},
        create: {
          module: mod,
          action: action,
          description: `Puede ${action} en ${mod}`,
        },
      });
      permissions.push(perm);
    }
  }
  console.log(`✅ Permisos creados: ${permissions.length} permisos`);

  // ==========================================
  // 3. Asignar Permisos a Roles
  // ==========================================
  const adminRole = roles.find((r) => r.name === 'ADMIN');
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  const gerenteRole = roles.find((r) => r.name === 'GERENTE');
  const gerentePerms = permissions.filter((p) => {
    if (['inventory', 'menu', 'stats', 'sales', 'ai'].includes(p.module)) return true;
    if (['users', 'backups'].includes(p.module) && p.action === 'read') return true;
    return false;
  });
  for (const perm of gerentePerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: gerenteRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: gerenteRole.id, permissionId: perm.id },
    });
  }

  const cajeroRole = roles.find((r) => r.name === 'CAJERO');
  const cajeroPerms = permissions.filter((p) => {
    if (p.module === 'sales') return true;
    if (['menu', 'inventory', 'ai'].includes(p.module) && p.action === 'read') return true;
    return false;
  });
  for (const perm of cajeroPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: cajeroRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: cajeroRole.id, permissionId: perm.id },
    });
  }

  const viewerRole = roles.find((r) => r.name === 'VISUALIZADOR');
  const viewerPerms = permissions.filter((p) => p.action === 'read');
  for (const perm of viewerPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: viewerRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: viewerRole.id, permissionId: perm.id },
    });
  }
  console.log('✅ Permisos asignados a todos los roles');

  // ==========================================
  // 4. Usuario Administrador Inicial
  // ==========================================
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@polloslallovizna.com' },
    update: { passwordHash: adminPasswordHash, isActive: true },
    create: {
      name: 'Administrador General',
      email: 'admin@polloslallovizna.com',
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });
  console.log(`✅ Usuario Admin creado/actualizado: ${adminUser.email} (Clave: admin123)`);

  // ==========================================
  // 5. Categorías de Insumos
  // ==========================================
  const catProteinas = await prisma.category.upsert({ where: { name: 'Proteínas' }, update: {}, create: { name: 'Proteínas', description: 'Pollos enteros, pechugas y carnes' } });
  const catVegetales = await prisma.category.upsert({ where: { name: 'Vegetales y Verduras' }, update: {}, create: { name: 'Vegetales y Verduras', description: 'Lechugas, tomates, cebollas' } });
  const catCarbohidratos = await prisma.category.upsert({ where: { name: 'Carbohidratos' }, update: {}, create: { name: 'Carbohidratos', description: 'Papas, harinas, arroz' } });
  const catAceites = await prisma.category.upsert({ where: { name: 'Aceites y Grasas' }, update: {}, create: { name: 'Aceites y Grasas', description: 'Aceites para freidoras' } });
  const catCondimentos = await prisma.category.upsert({ where: { name: 'Condimentos y Especias' }, update: {}, create: { name: 'Condimentos y Especias', description: 'Mix de adobos, sal, pimienta' } });
  const catBebidas = await prisma.category.upsert({ where: { name: 'Bebidas' }, update: {}, create: { name: 'Bebidas', description: 'Gaseosas y jugos' } });
  const catEmpaques = await prisma.category.upsert({ where: { name: 'Empaques y Desechables' }, update: {}, create: { name: 'Empaques y Desechables', description: 'Envases térmicos, bolsas' } });
  const catOtros = await prisma.category.upsert({ where: { name: 'Otros Insumos' }, update: {}, create: { name: 'Otros Insumos', description: 'Carbón vegetal, servilletas' } });
  console.log('✅ Categorías de insumos listas');

  // ==========================================
  // 6. Proveedores Habituales
  // ==========================================
  const supGranjita = await prisma.supplier.create({
    data: {
      name: 'Distribuidora Avícola La Granjita',
      contactPhone: '+58 414-1234567',
      contactEmail: 'pedidos@lagranjita.com',
      address: 'Zona Industrial 1, Galpón 4',
    },
  });

  const supAndinas = await prisma.supplier.create({
    data: {
      name: 'Agropecuaria Papas Andinas',
      contactPhone: '+58 424-7654321',
      contactEmail: 'ventas@papasandinas.com',
      address: 'Mercado Mayorista, Local 12',
    },
  });

  const supRoble = await prisma.supplier.create({
    data: {
      name: 'Víveres y Carbón El Roble',
      contactPhone: '+58 412-9988776',
      contactEmail: 'elroble@suministros.com',
      address: 'Av. Las Industrias #88',
    },
  });
  console.log('✅ Proveedores registrados');

  // ==========================================
  // 7. Productos e Insumos Iniciales
  // ==========================================
  const prodPollo = await prisma.product.create({
    data: {
      name: 'Pollo Fresco Entero',
      categoryId: catProteinas.id,
      unitOfMeasure: 'kg',
      currentPrice: 2.80,
      minStockThreshold: 35.0,
    },
  });

  const prodPapas = await prisma.product.create({
    data: {
      name: 'Papas Canchán Seleccionadas',
      categoryId: catCarbohidratos.id,
      unitOfMeasure: 'kg',
      currentPrice: 0.90,
      minStockThreshold: 50.0,
    },
  });

  const prodAceite = await prisma.product.create({
    data: {
      name: 'Aceite Vegetal Alto Rendimiento',
      categoryId: catAceites.id,
      unitOfMeasure: 'L',
      currentPrice: 1.80,
      minStockThreshold: 20.0,
    },
  });

  const prodCarbon = await prisma.product.create({
    data: {
      name: 'Carbón Vegetal de Quebracho',
      categoryId: catOtros.id,
      unitOfMeasure: 'kg',
      currentPrice: 0.60,
      minStockThreshold: 40.0,
    },
  });

  const prodHarina = await prisma.product.create({
    data: {
      name: 'Harina Especial Apanado Broster',
      categoryId: catCarbohidratos.id,
      unitOfMeasure: 'kg',
      currentPrice: 1.20,
      minStockThreshold: 15.0,
    },
  });

  const prodAdobo = await prisma.product.create({
    data: {
      name: 'Mix de Especias y Adobo La Llovizna',
      categoryId: catCondimentos.id,
      unitOfMeasure: 'kg',
      currentPrice: 3.50,
      minStockThreshold: 8.0,
    },
  });

  const prodGaseosa = await prisma.product.create({
    data: {
      name: 'Refresco Gaseosa 1.5L',
      categoryId: catBebidas.id,
      unitOfMeasure: 'unidades',
      currentPrice: 1.10,
      minStockThreshold: 24.0,
    },
  });
  console.log('✅ Insumos base registrados con precios actuales');

  // ==========================================
  // 8. Lotes de Inventario Iniciales
  // ==========================================
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const in20Days = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  // Lotes de pollo
  await prisma.inventoryLot.create({
    data: {
      productId: prodPollo.id,
      supplierId: supGranjita.id,
      quantityInitial: 40.0,
      quantityRemaining: 40.0,
      purchasePrice: 2.80,
      expirationDate: in3Days,
      lotCode: 'LOT-POL-001',
      status: 'ACTIVE',
    },
  });

  // Lotes de papas
  await prisma.inventoryLot.create({
    data: {
      productId: prodPapas.id,
      supplierId: supAndinas.id,
      quantityInitial: 80.0,
      quantityRemaining: 80.0,
      purchasePrice: 0.90,
      expirationDate: in20Days,
      lotCode: 'LOT-PAP-001',
      status: 'ACTIVE',
    },
  });

  // Lote de aceite
  await prisma.inventoryLot.create({
    data: {
      productId: prodAceite.id,
      supplierId: supRoble.id,
      quantityInitial: 30.0,
      quantityRemaining: 30.0,
      purchasePrice: 1.80,
      expirationDate: in60Days,
      lotCode: 'LOT-ACE-001',
      status: 'ACTIVE',
    },
  });

  // Lote de carbón
  await prisma.inventoryLot.create({
    data: {
      productId: prodCarbon.id,
      supplierId: supRoble.id,
      quantityInitial: 60.0,
      quantityRemaining: 60.0,
      purchasePrice: 0.60,
      expirationDate: in60Days,
      lotCode: 'LOT-CAR-001',
      status: 'ACTIVE',
    },
  });

  // Lote de harina broster
  await prisma.inventoryLot.create({
    data: {
      productId: prodHarina.id,
      supplierId: supAndinas.id,
      quantityInitial: 25.0,
      quantityRemaining: 25.0,
      purchasePrice: 1.20,
      expirationDate: in60Days,
      lotCode: 'LOT-HAR-001',
      status: 'ACTIVE',
    },
  });

  // Lote de adobo
  await prisma.inventoryLot.create({
    data: {
      productId: prodAdobo.id,
      supplierId: supRoble.id,
      quantityInitial: 12.0,
      quantityRemaining: 12.0,
      purchasePrice: 3.50,
      expirationDate: in60Days,
      lotCode: 'LOT-ADB-001',
      status: 'ACTIVE',
    },
  });

  // Lote de gaseosas
  await prisma.inventoryLot.create({
    data: {
      productId: prodGaseosa.id,
      supplierId: supRoble.id,
      quantityInitial: 36.0,
      quantityRemaining: 36.0,
      purchasePrice: 1.10,
      expirationDate: in60Days,
      lotCode: 'LOT-GAS-001',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Lotes de inventario inicializados con control FIFO');

  // ==========================================
  // 9. Platos con Receta y Margen Máximo 30%
  // ==========================================
  // Plato 1: 1/4 Pollo al Carbón con Papas
  // Costo: 0.4kg pollo ($1.12) + 0.35kg papas ($0.315) + 0.2kg carbón ($0.12) + adobo 0.03kg ($0.105) = $1.66
  // Margen 30%: $1.66 * 1.30 = $2.16
  const dish1 = await prisma.menuItem.create({
    data: {
      name: '1/4 Pollo al Carbón con Papas Fritas',
      description: 'Pierna o pechuga al carbón con papas crocantes y salsas de la casa',
      type: 'PLATO',
      productionCost: 1.66,
      suggestedPrice: 2.16,
      salePrice: 2.15,
      profitMarginPct: 29.5,
      isActive: true,
    },
  });
  await prisma.recipeItem.createMany({
    data: [
      { menuItemId: dish1.id, productId: prodPollo.id, quantityNeeded: 0.40, unitOfMeasure: 'kg' },
      { menuItemId: dish1.id, productId: prodPapas.id, quantityNeeded: 0.35, unitOfMeasure: 'kg' },
      { menuItemId: dish1.id, productId: prodCarbon.id, quantityNeeded: 0.20, unitOfMeasure: 'kg' },
      { menuItemId: dish1.id, productId: prodAdobo.id, quantityNeeded: 0.03, unitOfMeasure: 'kg' },
    ],
  });

  // Plato 2: 1/2 Pollo al Carbón con Papas
  // Costo: 0.8kg pollo ($2.24) + 0.6kg papas ($0.54) + 0.35kg carbón ($0.21) + adobo 0.05kg ($0.175) = $3.165
  // Margen 30%: $3.17 * 1.30 = $4.12
  const dish2 = await prisma.menuItem.create({
    data: {
      name: '1/2 Pollo al Carbón con Papas Fritas',
      description: 'Medio pollo al carbón jugoso y dorado con ración doble de papas fritas',
      type: 'PLATO',
      productionCost: 3.17,
      suggestedPrice: 4.12,
      salePrice: 4.10,
      profitMarginPct: 29.3,
      isActive: true,
    },
  });
  await prisma.recipeItem.createMany({
    data: [
      { menuItemId: dish2.id, productId: prodPollo.id, quantityNeeded: 0.80, unitOfMeasure: 'kg' },
      { menuItemId: dish2.id, productId: prodPapas.id, quantityNeeded: 0.60, unitOfMeasure: 'kg' },
      { menuItemId: dish2.id, productId: prodCarbon.id, quantityNeeded: 0.35, unitOfMeasure: 'kg' },
      { menuItemId: dish2.id, productId: prodAdobo.id, quantityNeeded: 0.05, unitOfMeasure: 'kg' },
    ],
  });

  // Plato 3: 1 Pollo Entero a la Brasa Familiar
  // Costo: 1.6kg pollo ($4.48) + 1.0kg papas ($0.90) + 0.6kg carbón ($0.36) + adobo 0.1kg ($0.35) = $6.09
  // Margen 30%: $6.09 * 1.30 = $7.92
  const dish3 = await prisma.menuItem.create({
    data: {
      name: '1 Pollo Entero al Carbón La Llovizna',
      description: 'Pollo entero marinado con nuestra receta secreta y papas familiares',
      type: 'PLATO',
      productionCost: 6.09,
      suggestedPrice: 7.92,
      salePrice: 7.90,
      profitMarginPct: 29.7,
      isActive: true,
    },
  });
  await prisma.recipeItem.createMany({
    data: [
      { menuItemId: dish3.id, productId: prodPollo.id, quantityNeeded: 1.60, unitOfMeasure: 'kg' },
      { menuItemId: dish3.id, productId: prodPapas.id, quantityNeeded: 1.00, unitOfMeasure: 'kg' },
      { menuItemId: dish3.id, productId: prodCarbon.id, quantityNeeded: 0.60, unitOfMeasure: 'kg' },
      { menuItemId: dish3.id, productId: prodAdobo.id, quantityNeeded: 0.10, unitOfMeasure: 'kg' },
    ],
  });

  // Plato 4: Pollo Broster Especial 8 Piezas
  // Costo: 1.5kg pollo ($4.20) + 0.8kg papas ($0.72) + 0.3L aceite ($0.54) + 0.3kg harina ($0.36) + adobo ($0.25) = $6.07
  // Margen 30%: $6.07 * 1.30 = $7.89
  const dish4 = await prisma.menuItem.create({
    data: {
      name: 'Pollo Broster Crujiente 8 Piezas',
      description: 'Ocho piezas crocantes de pollo broster con papas fritas y cremas',
      type: 'PLATO',
      productionCost: 6.07,
      suggestedPrice: 7.89,
      salePrice: 7.85,
      profitMarginPct: 29.3,
      isActive: true,
    },
  });
  await prisma.recipeItem.createMany({
    data: [
      { menuItemId: dish4.id, productId: prodPollo.id, quantityNeeded: 1.50, unitOfMeasure: 'kg' },
      { menuItemId: dish4.id, productId: prodPapas.id, quantityNeeded: 0.80, unitOfMeasure: 'kg' },
      { menuItemId: dish4.id, productId: prodAceite.id, quantityNeeded: 0.30, unitOfMeasure: 'L' },
      { menuItemId: dish4.id, productId: prodHarina.id, quantityNeeded: 0.30, unitOfMeasure: 'kg' },
      { menuItemId: dish4.id, productId: prodAdobo.id, quantityNeeded: 0.07, unitOfMeasure: 'kg' },
    ],
  });

  // Combo 1: Combo Fiesta Llovizna (1 Pollo Entero + Gaseosa 1.5L)
  // Costo: dish3 ($6.09) + Gaseosa ($1.10) = $7.19
  // Margen 30%: $7.19 * 1.30 = $9.35
  const combo1 = await prisma.menuItem.create({
    data: {
      name: 'Combo Fiesta Llovizna',
      description: '1 Pollo Entero al Carbón con papas familiares + Refresco Gaseosa 1.5L',
      type: 'COMBO',
      productionCost: 7.19,
      suggestedPrice: 9.35,
      salePrice: 9.30,
      profitMarginPct: 29.3,
      isActive: true,
    },
  });
  await prisma.comboItem.create({
    data: {
      comboId: combo1.id,
      menuItemId: dish3.id,
      quantity: 1,
    },
  });

  console.log('✅ Menú y Recetario creados respetando margen máximo del 30%');

  console.log('\n🎉 ================================================');
  console.log('   SISTEMA POLLOS LA LLOVIZNA LISTO Y CONFIGURADO');
  console.log('   Credenciales de Acceso Administrador:');
  console.log('   - Correo: admin@polloslallovizna.com');
  console.log('   - Clave:  admin123');
  console.log('   - PIN Maestro de Emergencia: LLOVIZNA2026');
  console.log('================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
