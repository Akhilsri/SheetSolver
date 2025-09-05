const notificationsService = require('./notifications.service');

async function handleGetNotifications(req, res) {
  try {
    // Get the logged-in user's ID from the token that was verified by the middleware
    const userId = req.user.userId;
    
    const notifications = await notificationsService.getNotificationsForUser(userId);
    
    res.status(200).json(notifications);
  } catch (error) {
    console.error('Get Notifications Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleMarkAsRead(req, res) {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;
    await notificationsService.markNotificationAsRead(notificationId, userId);
    res.status(200).json({ message: 'Notification marked as read.' });
  } catch (error) {
    console.error('Mark Notification as Read Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetUnreadCount(req, res) {
  try {
    const userId = req.user.userId;
    const count = await notificationsService.getUnreadCount(userId);
    res.status(200).json(count);
  } catch (error) {
    console.error('Get Unread Count Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

// Update the exports
module.exports = { handleGetNotifications, handleMarkAsRead, handleGetUnreadCount };