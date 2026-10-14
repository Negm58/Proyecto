const prisma = require('../config/database');

// GET /api/alerts
const getAlerts = async (req, res, next) => {
  try {
    const { isRead, alertType, limit } = req.query;
    const where = {};
    if (isRead !== undefined) where.isRead = isRead === 'true';
    if (alertType) where.alertType = alertType;

    const alerts = await prisma.alert.findMany({
      where,
      include: {
        product: {
          select: { id: true, name: true, unitOfMeasure: true, minStockThreshold: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit) : 50,
    });

    const unreadCount = await prisma.alert.count({ where: { isRead: false } });

    res.json({ success: true, data: { alerts, unreadCount } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/alerts/:id/read
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const alert = await prisma.alert.update({
      where: { id: parseInt(id) },
      data: { isRead: true },
    });
    res.json({ success: true, message: 'Alerta marcada como leída.', data: alert });
  } catch (error) {
    next(error);
  }
};

// PUT /api/alerts/mark-all-read
const markAllAsRead = async (req, res, next) => {
  try {
    await prisma.alert.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, message: 'Todas las alertas fueron marcadas como leídas.' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/alerts/:id
const deleteAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.alert.delete({ where: { id: parseInt(id) } });
    res.json({ success: true, message: 'Alerta eliminada.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAlerts, markAsRead, markAllAsRead, deleteAlert };
