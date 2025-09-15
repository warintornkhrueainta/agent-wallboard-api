// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// --- Create Express App ---
const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws://localhost:3001"]
    }
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// --- MongoDB Connection ---
const uri = "mongodb+srv://warintorn0987716154_db_user:wa098771@cluster.xem8pf9.mongodb.net/agentdb?retryWrites=true&w=majority";
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected!"))
  .catch(err => console.error("MongoDB connection error:", err));

// --- Models ---
const Agent = mongoose.model('Agent', new mongoose.Schema({
  agentCode: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  department: { type: String, default: 'General' },
  status: { type: String, default: 'Available' },
  loginTime: Date,
  lastStatusChange: { type: Date, default: Date.now }
}));

const Message = require('./models/Message');

// --- Routes ---
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Agent Wallboard API Enhanced v1.0' });
});

// CRUD Agents
app.get('/api/agents', async (req, res) => { const agents = await Agent.find(); res.json({ success: true, data: agents }); });
app.get('/api/agents/:id', async (req, res) => { const agent = await Agent.findById(req.params.id); if(!agent) return res.status(404).json({ success:false }); res.json({ success:true, data:agent }); });
app.post('/api/agents', async (req,res) => { const agent = new Agent(req.body); await agent.save(); res.status(201).json({ success:true, data:agent }); });
app.put('/api/agents/:id', async (req,res)=>{ const agent = await Agent.findByIdAndUpdate(req.params.id, req.body, {new:true, runValidators:true}); if(!agent) return res.status(404).json({success:false}); res.json({success:true,data:agent}); });
app.delete('/api/agents/:id', async (req,res)=>{ const agent = await Agent.findByIdAndDelete(req.params.id); if(!agent) return res.status(404).json({success:false}); res.json({success:true,message:'Agent deleted'}); });

// PATCH update agent status + WebSocket
app.patch('/api/agents/:id/status', async (req,res)=>{
  try {
    const agent = await Agent.findByIdAndUpdate(req.params.id, { status:req.body.status, lastStatusChange:new Date() }, { new:true, runValidators:true });
    if(!agent) return res.status(404).json({ success:false });
    io.emit('agentStatusChanged', { agentId:agent._id, agentCode:agent.agentCode, newStatus:agent.status, timestamp:agent.lastStatusChange });
    res.json({ success:true, data:agent });
  } catch(e){ res.status(400).json({ success:false, message:e.message }); }
});

// Messages
app.post('/api/messages', async(req,res)=>{
  try {
    const {from,to,message} = req.body;
    const newMessage = new Message({from,to,message});
    await newMessage.save();
    io.emit('newMessage', { from,to,message,timestamp:newMessage.timestamp });
    res.status(201).json({ success:true, data:newMessage });
  } catch(e){ res.status(400).json({ success:false, message:e.message }); }
});

app.get('/api/messages/:agentCode', async(req,res)=>{
  const { agentCode } = req.params;
  const messages = await Message.find({ $or:[{to:agentCode},{to:'ALL'}] }).sort({ timestamp:-1 });
  res.json({ success:true, data:messages });
});

// Health check
app.get('/api/health', (req,res)=>res.json({ success:true, message:'Server running' }));

// --- HTTP Server + WebSocket ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin:'http://localhost:3000', methods:['GET','POST'] }
});

io.on('connection', socket => {
  console.log('User connected:', socket.id);
  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// --- Start server ---
server.listen(PORT, ()=>console.log(`🚀 Server running at http://localhost:${PORT}`));
