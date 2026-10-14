const cron = require('node-cron');
const { checkLowStock } = require('./stockAlertJob');
const { checkExpirations } = require('./expirationJob');

/**
 * Inicializador de tareas programadas (Cron Jobs)
 */
const initCronJobs = (io) => {
  console.log('⏰ Inicializando tareas programadas (Cron)...');

  // Ejecutar verificación inicial inmediata
  setTimeout(() => {
    checkLowStock(io);
    checkExpirations(io);
  }, 3000);

  // Verificación de stock bajo: cada 30 minutos
  cron.schedule('*/30 * * * *', () => {
    console.log('🔄 Ejecutando cron: Verificación de stock bajo...');
    checkLowStock(io);
  });

  // Verificación de vencimientos: una vez al día a las 08:00 AM (o configurable)
  cron.schedule('0 8 * * *', () => {
    console.log('🔄 Ejecutando cron: Verificación de vencimiento de lotes...');
    checkExpirations(io);
  });

  // Respaldo automático de base de datos (según BACKUP_CRON o semanal los domingos a las 02:00 AM)
  const backupService = require('../services/backupService');
  const backupCron = process.env.BACKUP_CRON || '0 2 * * 0';
  cron.schedule(backupCron, async () => {
    console.log('🔄 Ejecutando cron: Respaldo automático de base de datos...');
    try {
      const backup = await backupService.createBackup({ backupType: 'SCHEDULED' });
      console.log(`✅ Respaldo automático completado: ${backup.filename} (${backup.fileSize})`);
      if (io) io.emit('backup:created', backup);
    } catch (err) {
      console.error('❌ Error en respaldo automático programado:', err.message);
    }
  });

  console.log('✅ Cron Jobs activos.');
};

module.exports = { initCronJobs };
