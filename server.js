const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

// Winston logger
const { createLogger, format, transports } = require('winston');
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.colorize(),
    format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
  ),
  transports: [new transports.Console()]
});

// Import routes และ middleware
const routes = require('./routes');
const { globalErrorHandler, notFoundHandler, performanceMonitor } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect('mongodb+srv://warintorn0987716154_db_user:wa098771@cluster.xem8pf9.mongodb.net/ชื่อDatabase?retryWrites=true&w=majority')
  .then(() => logger.info('✅ MongoDB connected'))
  .catch(err => logger.error('❌ MongoDB connection error:', err));

// Agent Schema & Model
const agentSchema = new mongoose.Schema({
  agentCode: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  department: { type: String, default: 'General' },
  status: { type: String, default: 'Available' },
  loginTime: Date,
  lastStatusChange: { type: Date, default: Date.now }
});
const Agent = mongoose.model('Agent', agentSchema);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Request logging (เฉพาะ development)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Performance monitoring
app.use(performanceMonitor);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Agent Wallboard API Enhanced v1.0',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    documentation: '/api/docs',
    health: '/api/health',
    endpoints: {
      agents: '/api/agents',
      health: '/api/health',
      docs: '/api/docs'
    }
  });
});

// Wallboard page
app.get('/test-websocket.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-websocket.html'));
});

// CRUD APIs
app.get('/api/agents', async (req, res) => {
  try {
    const agents = await Agent.find();
    res.json({ success: true, data: agents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/agents/:id', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });
    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/agents', async (req, res) => {
  try {
    const agent = new Agent(req.body);
    await agent.save();
    res.status(201).json({ success: true, data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.put('/api/agents/:id', async (req, res) => {
  try {
    const agent = await Agent.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });
    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.delete('/api/agents/:id', async (req, res) => {
  try {
    const agent = await Agent.findByIdAndDelete(req.params.id);
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });
    res.json({ success: true, message: 'Agent deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH update agent status with real-time WebSocket
app.patch('/api/agents/:id/status', async (req, res) => {
  try {
    const agent = await Agent.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status, lastStatusChange: new Date() },
      { new: true, runValidators: true }
    );
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

    // ส่ง real-time update
    io.emit('agentStatusChanged', {
      agentId: agent._id,
      agentCode: agent.agentCode,
      newStatus: agent.status,
      timestamp: agent.lastStatusChange
    });

    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Message Model
const messageSchema = new mongoose.Schema({
  from: { type: String, required: true },    // Supervisor name
  to: { type: String, required: true },      // Agent code หรือ 'ALL'
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});
messageSchema.statics.getAgentMessages = async function(agentCode) {
  return this.find({ $or: [{ to: agentCode }, { to: 'ALL' }] }).sort({ timestamp: -1 });
};
messageSchema.statics.markAsRead = async function(messageId) {
  return this.findByIdAndUpdate(messageId, { read: true }, { new: true });
};
messageSchema.statics.getConversation = async function(agentCode, supervisor) {
  return this.find({
    $or: [
      { from: supervisor, to: agentCode },
      { from: agentCode, to: supervisor }
    ]
  }).sort({ timestamp: 1 });
};
const Message = mongoose.model('Message', messageSchema);

app.post('/api/messages', async (req, res) => {
  try {
    const { from, to, message } = req.body;
    const newMessage = new Message({ from, to, message });
    await newMessage.save();

    io.emit('newMessage', {
      from,
      to,
      message,
      timestamp: newMessage.timestamp
    });

    res.status(201).json({ success: true, data: newMessage });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/messages/:agentCode', async (req, res) => {
  try {
    const { agentCode } = req.params;
    const messages = await Message.find({
      $or: [{ to: agentCode }, { to: 'ALL' }]
    }).sort({ timestamp: -1 });

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// API routes
app.use('/api', routes);

// Health check
app.get('/api/health', (req, res) => res.send({ success: true, message: 'Server is running' }));

// API routes
app.use('/api', routes);

// ✅ ปิด log 404 DevTools
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});

// Error handlers
app.use('*', notFoundHandler);
app.use(globalErrorHandler);

// Create HTTP server and WebSocket
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' }
});


// WebSocket connection
io.on('connection', (socket) => {
  logger.info(`🔌 User connected: ${socket.id}`);

  // เข้าร่วมห้องของ Agent ตาม agentCode
  socket.on('join', (agentCode) => {
    socket.join(agentCode);
    logger.info(`🟢 User joined room: ${agentCode}`);
  });

  // รับข้อความส่วนตัวหรือ broadcast
  socket.on('sendMessage', ({ from, to, message }) => {
    const msg = {
      from,
      to,
      message,
      timestamp: new Date()
    };

    // ส่ง event 'newMessage' ให้เฉพาะห้องที่เกี่ยวข้อง
    if (to === 'ALL') {
      io.emit('newMessage', msg); // broadcast ทุกคน
    } else {
      io.to(to).emit('newMessage', msg); // ส่งเฉพาะ agent
    }

    logger.info(`✉️ Message from ${from} to ${to}: ${message}`);
  });

  // เมื่อ user ตัดการเชื่อมต่อ
  socket.on('disconnect', () => {
    logger.info(`🔴 User disconnected: ${socket.id}`);
  });
});


// Start server
server.listen(PORT, () => {
  logger.info('🚀 Agent Wallboard API Enhanced with WebSocket');
  logger.info(`📡 Server running on http://localhost:${PORT}`);
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  logger.info(`💚 Health Check: http://localhost:${PORT}/api/health`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.warn('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('✅ Process terminated');
  });
});

module.exports = app;
