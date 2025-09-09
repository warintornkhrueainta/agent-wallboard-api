const { Agent, agents } = require('../models/Agent');
const { AGENT_STATUS, VALID_STATUS_TRANSITIONS, API_MESSAGES } = require('../utils/constants');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const agentController = {
  // GET /api/agents/:id
  getAgentById: (req, res) => {
    try {
      const { id } = req.params;
      const agent = agents.get(id);
      if (!agent) return sendError(res, API_MESSAGES.AGENT_NOT_FOUND, 404);

      console.log(`📋 Retrieved agent: ${agent.agentCode}`);
      return sendSuccess(res, 'Agent retrieved successfully', agent.toJSON());
    } catch (error) {
      console.error('Error in getAgentById:', error);
      return sendError(res, API_MESSAGES.INTERNAL_ERROR, 500);
    }
  },

  // GET /api/agents
  getAllAgents: (req, res) => {
    try {
      let allAgents = Array.from(agents.values());

      // Filter by status and/or department if query params exist
      const { status, department } = req.query;
      if (status) allAgents = allAgents.filter(agent => agent.status === status);
      if (department) allAgents = allAgents.filter(agent => agent.department === department);

      const data = allAgents.map(agent => agent.toJSON());
      return sendSuccess(res, 'Agents retrieved successfully', data);
    } catch (error) {
      console.error('Error in getAllAgents:', error);
      return sendError(res, API_MESSAGES.INTERNAL_ERROR, 500);
    }
  },

  // Solution hints:
getAllAgents: (req, res) => {
  try {
    const { status, department } = req.query;
    let agentList = Array.from(agents.values());

    // Filter by status
    if (status) {
      agentList = agentList.filter(agent => agent.status === status);
    }
    
    // Filter by department  
    if (department) {
      agentList = agentList.filter(agent => agent.department === department);
    }

    console.log(`📋 Retrieved ${agentList.length} agents`);
    return sendSuccess(res, 'Agents retrieved successfully', 
      agentList.map(agent => agent.toJSON())
    );
  } catch (error) {
    console.error('Error in getAllAgents:', error);
    return sendError(res, API_MESSAGES.INTERNAL_ERROR, 500);
  }
},

  // POST /api/agents
  createAgent: (req, res) => {
    try {
      const agentData = req.body;

      // ตรวจสอบว่า agentCode ซ้ำไหม
      const exists = Array.from(agents.values()).find(a => a.agentCode === agentData.agentCode);
      if (exists) return sendError(res, API_MESSAGES.AGENT_CODE_EXISTS, 400);

      // สร้าง Agent ใหม่
      const newAgent = new Agent(agentData);
      agents.set(newAgent.id, newAgent);

      console.log(`➕ Created new agent: ${newAgent.agentCode}`);
      return sendSuccess(res, API_MESSAGES.AGENT_CREATED, newAgent.toJSON(), 201);
    } catch (error) {
      console.error('Error in createAgent:', error);
      return sendError(res, API_MESSAGES.INTERNAL_ERROR, 500);
    }
  },

  // PUT /api/agents/:id
  updateAgent: (req, res) => {
    try {
      const { id } = req.params;
      const agent = agents.get(id);
      if (!agent) return sendError(res, API_MESSAGES.AGENT_NOT_FOUND, 404);

      const { name, email, department, skills } = req.body;

      if (name) agent.name = name;
      if (email) agent.email = email;
      if (department) agent.department = department;
      if (skills) agent.skills = skills;

      agent.updatedAt = new Date();
      console.log(`✏️ Updated agent: ${agent.agentCode}`);
      return sendSuccess(res, API_MESSAGES.AGENT_UPDATED, agent.toJSON());
    } catch (error) {
      console.error('Error in updateAgent:', error);
      return sendError(res, API_MESSAGES.INTERNAL_ERROR, 500);
    }
  },

  // PATCH /api/agents/:id/status
  updateAgentStatus: (req, res) => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      const agent = agents.get(id);
      if (!agent) return sendError(res, API_MESSAGES.AGENT_NOT_FOUND, 404);

      // validate status
      if (!Object.values(AGENT_STATUS).includes(status)) {
        return sendError(res, API_MESSAGES.INVALID_STATUS, 400);
      }

      // validate transition
      const validTransitions = VALID_STATUS_TRANSITIONS[agent.status] || [];
      if (!validTransitions.includes(status)) {
        return sendError(res, API_MESSAGES.INVALID_STATUS_TRANSITION, 400);
      }

      // update status
      agent.updateStatus(status, reason);
      console.log(`🔄 Agent ${agent.agentCode} status updated to ${status}`);
      return sendSuccess(res, API_MESSAGES.AGENT_STATUS_UPDATED, agent.toJSON());
    } catch (error) {
      console.error('Error in updateAgentStatus:', error);
      return sendError(res, API_MESSAGES.INTERNAL_ERROR, 500);
    }
  },

  // DELETE /api/agents/:id
  deleteAgent: (req, res) => {
    try {
      const { id } = req.params;
      const agent = agents.get(id);
      if (!agent) return sendError(res, API_MESSAGES.AGENT_NOT_FOUND, 404);

      agents.delete(id);
      console.log(`🗑️ Deleted agent: ${agent.agentCode} - ${agent.name}`);
      return sendSuccess(res, API_MESSAGES.AGENT_DELETED);
    } catch (error) {
      console.error('Error in deleteAgent:', error);
      return sendError(res, API_MESSAGES.INTERNAL_ERROR, 500);
    }
  },

  // GET /api/agents/status/summary
  getStatusSummary: (req, res) => {
    try {
      const agentList = Array.from(agents.values());
      const totalAgents = agentList.length;

      const statusCounts = {};
      Object.values(AGENT_STATUS).forEach(status => {
        statusCounts[status] = agentList.filter(agent => agent.status === status).length;
      });

      const statusPercentages = {};
      Object.entries(statusCounts).forEach(([status, count]) => {
        statusPercentages[status] = totalAgents > 0 ? Math.round((count / totalAgents) * 100) : 0;
      });

      const summary = {
        totalAgents,
        statusCounts,
        statusPercentages,
        lastUpdated: new Date().toISOString()
      };

      return sendSuccess(res, 'Status summary retrieved successfully', summary);
    } catch (error) {
      console.error('Error in getStatusSummary:', error);
      return sendError(res, API_MESSAGES.INTERNAL_ERROR, 500);
    }
  }
};


module.exports = agentController;
