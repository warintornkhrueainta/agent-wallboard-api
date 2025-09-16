// routes/messages.js
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');


router.get('/', messageController.getAllMessages);


router.post('/', messageController.sendMessage);

router.get('/:agentCode', messageController.getMessagesForAgent);


router.put('/:id', messageController.updateMessage);


router.delete('/:id', messageController.deleteMessage);

module.exports = router;