// routes/agentRoutes.js
const express = require('express');
const router = express.Router();

const agentController = require('../controllers/agentController');
const { validateAgent, validateStatusUpdate } = require('../middleware/validation');

// 📝 Routes mapping
router.get('/', agentController.getAllAgents);                     // GET all agents
router.get('/:id', agentController.getAgentById);                  // GET single agent
router.post('/', validateAgent, agentController.createAgent);      // CREATE agent
router.put('/:id', validateAgent, agentController.updateAgent);    // UPDATE agent
router.patch('/:id/status', validateStatusUpdate, agentController.updateAgentStatus); // UPDATE status
router.delete('/:id', agentController.deleteAgent);                // DELETE agent

// Dashboard route
router.get('/status/summary', agentController.getStatusSummary);

module.exports = router;
