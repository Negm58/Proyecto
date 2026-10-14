require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Importar rutas
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const supplierRoutes = require('./src/routes/supplierRoutes');
const productRoutes = require('./src/routes/productRoutes');
const inventoryRoutes = require('./src/routes/inventoryRoutes');
const menuRoutes = require('./src/routes/menuRoutes');
const saleRoutes = require('./src/routes/saleRoutes');
const statsRoutes = require('./src/routes/statsRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const backupRoutes = require('./src/routes/backupRoutes');
const alertRoutes = require('./src/routes/alertRoutes');

// Importar middleware
const { errorHandler } = require('./src/middlewares/errorHandler');

// Importar jobs
const { initCronJobs } = require('./src/jobs/cronManager');

const app = express();
const server = http.createServer(app);

// Configurar Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Hacer io accesible en los controladores
app.set('io', io);

// Middlewares globales
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/alerts', alertRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: '🍗 API del Sistema de Inventario funcionando correctamente',
    timestamp: new Date().toISOString(),
  });
});

// Manejo de errores global
app.use(errorHandler);

// Socket.io - Conexiones
io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });
});

// Iniciar cron jobs
initCronJobs(io);

// Iniciar servidor
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🍗 ========================================`);
  console.log(`   Servidor de Inventario iniciado`);
  console.log(`   Puerto: ${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log(`🍗 ========================================\n`);
});

module.exports = { app, server, io };
