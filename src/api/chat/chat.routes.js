const express = require('express');
const chatController = require('./chat.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const router = express.Router();

router.get('/:roomId', authMiddleware, chatController.handleGetChatHistory);
// ... (keep existing route)
router.get('/direct/:connectionUserId', authMiddleware, chatController.handleGetDirectMessageHistory);
// ... (keep existing routes)
router.get('/unread-count', authMiddleware, chatController.handleGetUnreadCount);
router.put('/direct/:senderId/read', authMiddleware, chatController.handleMarkAsRead);


module.exports = router;