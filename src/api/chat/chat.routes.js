const express = require('express');
const chatController = require('./chat.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const router = express.Router();

router.get('/:roomId', authMiddleware, chatController.handleGetChatHistory);

module.exports = router;