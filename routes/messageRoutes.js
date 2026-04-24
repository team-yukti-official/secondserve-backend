const express = require('express');
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/send', authMiddleware, messageController.sendMessage);
router.get('/conversation/:otherId', authMiddleware, messageController.getConversation);
router.get('/conversations', authMiddleware, messageController.getConversations);

module.exports = router;
