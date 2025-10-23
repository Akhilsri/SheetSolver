const notificationsService = require('./notifications.service');
const crypto = require('crypto'); // Used for simple ETag generation

// Helper function to generate ETag from data
function generateEtag(data) {
    const dataString = JSON.stringify(data);
    return crypto.createHash('md5').update(dataString).digest('hex');
}

async function handleGetNotifications(req, res) {
    try {
        const userId = req.user.userId;
        const ifNoneMatch = req.header('If-None-Match'); // 1. Get ETag from client

        // --- Fetch Data ---
        const notifications = await notificationsService.getNotificationsForUser(userId);

        // 2. Generate ETag for current data
        const currentEtag = generateEtag(notifications);

        // 3. Check for Cache Hit
        if (ifNoneMatch === currentEtag) {
            // Cache Hit: Data hasn't changed. Send 304 response. 
            // This response is extremely cheap.
            res.header('ETag', currentEtag).status(304).send(); 
            return;
        }

        // Cache Miss: Send new data and ETag
        res.header('ETag', currentEtag)
           .status(200)
           .json(notifications);
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

async function handleMarkAllAsRead(req, res) {
  try {
    const userId = req.user.userId;
    await notificationsService.markAllNotificationsAsRead(userId);
    res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

// Update the exports
module.exports = { handleGetNotifications, handleMarkAsRead, handleGetUnreadCount,handleMarkAllAsRead };