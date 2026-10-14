const backupService = require('../services/backupService');

// POST /api/backups/execute
const executeBackup = async (req, res, next) => {
  try {
    const result = await backupService.createBackup({
      userId: req.user.id,
      backupType: 'MANUAL',
    });
    res.status(201).json({
      success: true,
      message: 'Copia de seguridad generada con éxito.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/backups/logs
const getLogs = async (req, res, next) => {
  try {
    const logs = await backupService.getBackupLogs();
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};

// GET /api/backups/download/:id
const downloadBackup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { filePath, filename } = await backupService.getBackupFile(id);
    res.download(filePath, filename);
  } catch (error) {
    next(error);
  }
};

// POST /api/backups/restore/:id
const restoreBackup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await backupService.restoreBackup(id, req.user?.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// POST /api/backups/restore-file
const restoreFromFile = async (req, res, next) => {
  try {
    const backupData = req.body;
    const result = await backupService.restoreFromData(backupData, req.user?.id, 'Carga directa de archivo JSON');
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { executeBackup, getLogs, downloadBackup, restoreBackup, restoreFromFile };
