const express = require('express');
const router = express.Router();

// import routes
const agentRoutes = require('./agents');   // ✅


router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API documentation
router.get('/docs', (req, res) => {
  res.json({
    title: 'Agent Wallboard API Documentation',
    version: '1.0.0',
    baseUrl: `${req.protocol}://${req.get('host')}`,
    endpoints: {
      'GET /api/health': 'API health check',
      'GET /api/agents': 'List all agents (supports ?status= and ?department=)',
      'POST /api/agents': 'Create new agent',
      'GET /api/agents/:id': 'Get specific agent',
      'PUT /api/agents/:id': 'Update agent information',
      'PATCH /api/agents/:id/status': 'Update agent status',
      'DELETE /api/agents/:id': 'Delete agent',
      'GET /api/agents/status/summary': 'Agent status summary'
    },
    examples: {
      createAgent: {
        method: 'POST',
        url: '/api/agents',
        body: {
          agentCode: 'A999',
          name: 'John Doe',
          email: 'john@company.com',
          department: 'Sales',
          skills: ['Thai', 'English']
        }
      }
    }
  });
});

// Mount agent routes
router.use('/agents', agentRoutes);

module.exports = router;