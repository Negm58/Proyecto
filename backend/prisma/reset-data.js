const prisma = require('../src/config/database');

async function reset() {
  console.log('Iniciando reseteo de estadísticas, insumos y platos...');

  // 1. Limpiar ventas
  const deletedSaleItems = await prisma.saleItem.deleteMany({});
  const deletedSales = await prisma.sale.deleteMany({});
  console.log(`✓ Ventas eliminadas: ${deletedSales.count} ventas, ${deletedSaleItems.count} items de venta.`);

  // 2. Limpiar menú, recetas y combos
  const deletedRecipeItems = await prisma.recipeItem.deleteMany({});
  const deletedComboItems = await prisma.comboItem.deleteMany({});
  const deletedMenuItems = await prisma.menuItem.deleteMany({});
  console.log(`✓ Menú eliminado: ${deletedMenuItems.count} platos/combos, ${deletedRecipeItems.count} recetas, ${deletedComboItems.count} combo-items.`);

  // 3. Limpiar movimientos, lotes y materias primas (insumos)
  const deletedMovements = await prisma.inventoryMovement.deleteMany({});
  const deletedLots = await prisma.inventoryLot.deleteMany({});
  const deletedPrices = await prisma.priceHistory.deleteMany({});
  const deletedProdSuppliers = await prisma.productSupplier.deleteMany({});
  const deletedAlerts = await prisma.alert.deleteMany({});
  const deletedProducts = await prisma.product.deleteMany({});
  console.log(`✓ Insumos eliminados: ${deletedProducts.count} materias primas, ${deletedLots.count} lotes, ${deletedMovements.count} movimientos.`);

  // 4. Limpiar gastos operativos y estadísticas
  const deletedExpenses = await prisma.operationalExpense.deleteMany({});
  console.log(`✓ Gastos operativos eliminados: ${deletedExpenses.count} gastos.`);

  // 5. Verificar que el usuario Admin y Roles siguen intactos
  const userCount = await prisma.user.count();
  const roleCount = await prisma.role.count();
  console.log(`✓ Usuarios activos conservados: ${userCount} usuarios, ${roleCount} roles.`);

  console.log('🎉 RESIDUOS Y DATOS ANTIGUOS LIMPIADOS CON ÉXITO. Sistema listo para nuevos registros.');
}

reset()
  .catch((e) => {
    console.error('Error durante el reseteo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
