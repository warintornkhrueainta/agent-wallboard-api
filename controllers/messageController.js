// controllers/messageController.js
const Message = require('../models/Message');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const messageController = {
    // GET /api/messages
    getAllMessages: async (req, res) => {
        try {
            const messages = await Message.find().sort({ timestamp: -1 });
            return sendSuccess(res, 'All messages retrieved successfully', messages);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    },

    // POST /api/messages
    sendMessage: async (req, res) => {
        try {
            const { from, to, message } = req.body;

            const newMessage = new Message({ from, to, message });
            await newMessage.save();

            // 🔴 Real-time broadcast
            req.io.emit('newMessage', {
                from,
                to,
                message,
                timestamp: newMessage.timestamp
            });

            return sendSuccess(res, 'Message sent successfully', newMessage, 201);
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    },

    // GET /api/messages/:agentCode
    getMessagesForAgent: async (req, res) => {
        try {
            const { agentCode } = req.params;

            const messages = await Message.find({
                $or: [{ to: agentCode }, { to: 'ALL' }]
            }).sort({ timestamp: -1 });

            return sendSuccess(res, 'Messages retrieved successfully', messages);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    },

    // PUT /api/messages/:id
    updateMessage: async (req, res) => {
        try {
            const { id } = req.params;
            const { message } = req.body;

            const updated = await Message.findByIdAndUpdate(
                id,
                { message },
                { new: true }
            );

            if (!updated) return sendError(res, 'Message not found', 404);

            // 🔴 Real-time broadcast
            req.io.emit('messageUpdated', updated);

            return sendSuccess(res, 'Message updated successfully', updated);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    },

    // DELETE /api/messages/:id
    deleteMessage: async (req, res) => {
        try {
            const { id } = req.params;
            const deleted = await Message.findByIdAndDelete(id);

            if (!deleted) return sendError(res, 'Message not found', 404);

            // 🔴 Real-time broadcast
            req.io.emit('messageDeleted', deleted._id);

            return sendSuccess(res, 'Message deleted successfully');
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
};

module.exports = messageController;
