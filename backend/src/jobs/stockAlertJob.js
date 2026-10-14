const prisma = require('../config/database');

/**
 * Tarea programada para verificar niveles de stock bajo y emitir alertas.
 */
const checkLowStock = async (io) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        inventoryLots: {
          where: { status: 'ACTIVE', quantityRemaining: { gt: 0 } },
          select: { quantityRemaining: true },
        },
      },
    });

    for (const product of products) {
      const currentStock = product.inventoryLots.reduce((sum, l) => sum + l.quantityRemaining, 0);

      if (currentStock <= product.minStockThreshold) {
        // Verificar si ya existe alerta no leída
        const existingAlert = await prisma.alert.findFirst({
          where: {
            productId: product.id,
            alertType: 'LOW_STOCK',
            isRead: false,
          },
        });

        if (!existingAlert) {
          const alert = await prisma.alert.create({
            data: {
              productId: product.id,
              alertType: 'LOW_STOCK',
              message: `⚠️ Stock crítico: "${product.name}" tiene ${currentStock.toFixed(2)} ${product.unitOfMeasure} (Umbral mínimo: ${product.minStockThreshold} ${product.unitOfMeasure}).`,
            },
            include: { product: true },
          });

          if (io) {
            io.emit('alert:new', alert);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error en tarea de verificación de stock bajo:', error.message);
  }
};

module.exports = { checkLowStock };
