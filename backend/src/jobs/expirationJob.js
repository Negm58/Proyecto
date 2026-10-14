const prisma = require('../config/database');

/**
 * Tarea programada para verificar lotes por vencer o ya vencidos
 */
const checkExpirations = async (io) => {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Buscar lotes activos que vencen en los próximos 3 días o ya vencidos
    const expiringLots = await prisma.inventoryLot.findMany({
      where: {
        status: 'ACTIVE',
        quantityRemaining: { gt: 0 },
        expirationDate: {
          not: null,
          lte: threeDaysFromNow,
        },
      },
      include: { product: true },
    });

    for (const lot of expiringLots) {
      const isExpired = new Date(lot.expirationDate) < now;
      const alertType = isExpired ? 'EXPIRED' : 'EXPIRING_SOON';
      const daysLeft = Math.ceil((new Date(lot.expirationDate) - now) / (1000 * 60 * 60 * 24));

      const message = isExpired
        ? `⛔ Lote VENCIDO: "${lot.product.name}" (Lote: ${lot.lotCode || '#' + lot.id}) con ${lot.quantityRemaining} ${lot.product.unitOfMeasure}. Retirar de uso.`
        : `⏰ Lote por vencer: "${lot.product.name}" (Lote: ${lot.lotCode || '#' + lot.id}) vence en ${daysLeft} día(s). Priorizar salida (FIFO).`;

      const existingAlert = await prisma.alert.findFirst({
        where: {
          productId: lot.productId,
          alertType,
          isRead: false,
        },
      });

      if (!existingAlert) {
        const alert = await prisma.alert.create({
          data: {
            productId: lot.productId,
            alertType,
            message,
          },
          include: { product: true },
        });

        if (io) {
          io.emit('alert:new', alert);
        }
      }

      // Si ya está vencido, actualizar estado del lote
      if (isExpired && lot.status === 'ACTIVE') {
        await prisma.inventoryLot.update({
          where: { id: lot.id },
          data: { status: 'EXPIRED' },
        });
      }
    }
  } catch (error) {
    console.error('Error en tarea de verificación de vencimientos:', error.message);
  }
};

module.exports = { checkExpirations };
