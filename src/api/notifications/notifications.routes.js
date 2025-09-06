const express = require('express');
const notificationsController = require('./notifications.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = express.Router();

// A user must be logged in to get their own notifications
router.get('/', authMiddleware, notificationsController.handleGetNotifications);

router.get('/unread-count', authMiddleware, notificationsController.handleGetUnreadCount);
router.put('/:notificationId/read', authMiddleware, notificationsController.handleMarkAsRead);
router.put('/read-all', authMiddleware, notificationsController.handleMarkAllAsRead);

module.exports = router;