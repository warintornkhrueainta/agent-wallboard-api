const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
 require('dotenv').config();
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');


// Import routes และ middleware
const routes = require('./routes');
const { globalErrorHandler, notFoundHandler, performanceMonitor } = require('./middleware/errorHandler');




const app = express();
const PORT = process.env.PORT || 3001;

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));


// MongoDB connection
const mongoose = require('mongoose');

mongoose.connect(
  'mongodb+srv://warintorn0987716154_db_user:wa098771%21@cluster.xem8pf9.mongodb.net/agentdb?retryWrites=true&w=majority&appName=Cluster'
)
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));



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
// Serve static files from 'public' folder
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



app.get('/', (req, res) => {
  res.send('Agent Wallboard API is running!');
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




// Health check
app.get('/api/health', (req, res) => res.send({ success: true, message: 'Server is running' }));




// API routes
app.use('/api', routes);




// Error handlers (ต้องอยู่ท้ายสุด)
app.use('*', notFoundHandler);
app.use(globalErrorHandler);


// models/Message.js
const messageSchema = new mongoose.Schema({
  from: { type: String, required: true },    // Supervisor name
  to: { type: String, required: true },      // Agent code หรือ 'ALL'
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});


// Static method: ดึงข้อความทั้งหมดของ Agent
messageSchema.statics.getAgentMessages = async function(agentCode) {
  return this.find({
    $or: [{ to: agentCode }, { to: 'ALL' }]
  }).sort({ timestamp: -1 });
};


// Static method: mark message เป็น read
messageSchema.statics.markAsRead = async function(messageId) {
  return this.findByIdAndUpdate(messageId, { read: true }, { new: true });
};


// Static method: conversation history ระหว่าง Supervisor กับ Agent
messageSchema.statics.getConversation = async function(agentCode, supervisor) {
  return this.find({
    $or: [
      { from: supervisor, to: agentCode },
      { from: agentCode, to: supervisor }
    ]
  }).sort({ timestamp: 1 }); // เรียงจากเก่าสุด → ล่าสุด
};


module.exports = mongoose.model('Message', messageSchema);


// Create HTTP server and WebSocket
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' }
});


// WebSocket connection
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
 
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});




// Start server
server.listen(PORT, () => {
  console.log('🚀 Agent Wallboard API Enhanced with WebSocket');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});




// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});




module.exports = app;
