const aiService = require('../services/aiService');
const fs = require('fs');
const path = require('path');

// POST /api/ai/chat
const chat = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'El mensaje es requerido.' });
    }

    const reply = await aiService.processQuery(req.user.id, message);

    res.json({
      success: true,
      data: {
        message: reply,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/ai/history
const getHistory = async (req, res, next) => {
  try {
    const history = await aiService.getChatHistory(req.user.id);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/ai/history
const clearHistory = async (req, res, next) => {
  try {
    await aiService.clearChatHistory(req.user.id);
    res.json({ success: true, message: 'Historial de chat limpiado.' });
  } catch (error) {
    next(error);
  }
};

// GET /api/ai/status
const getStatus = async (req, res, next) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const isConfigured = Boolean(apiKey && apiKey.trim() !== '');
    res.json({
      success: true,
      data: {
        geminiConfigured: isConfigured,
        activeEngine: isConfigured ? 'Google Gemini AI' : 'Motor Analítico Local Dinámico',
        restaurant: 'Pollos La Llovizna',
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/ai/config
const saveConfig = async (req, res, next) => {
  try {
    const { apiKey } = req.body;
    if (apiKey !== undefined) {
      process.env.GEMINI_API_KEY = apiKey.trim();
      const envPath = path.join(__dirname, '../../.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('GEMINI_API_KEY=')) {
          envContent = envContent.replace(/GEMINI_API_KEY=.*(\r?\n|$)/, `GEMINI_API_KEY=${apiKey.trim()}$1`);
        } else {
          envContent += `\nGEMINI_API_KEY=${apiKey.trim()}`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      }
    }

    const isConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
    res.json({
      success: true,
      message: isConfigured ? 'API Key de Gemini configurada correctamente.' : 'Se restableció al motor analítico local.',
      data: { geminiConfigured: isConfigured },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { chat, getHistory, clearHistory, getStatus, saveConfig };
