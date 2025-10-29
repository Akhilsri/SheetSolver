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
        
        // Extract pagination parameters
        const limit = parseInt(req.query.limit) || 20; // Default limit of 20
        const offset = parseInt(req.query.offset) || 0; // Default start at 0
        
        // Ensure values are sane
        if (limit > 100 || limit < 1 || offset < 0) {
            return res.status(400).json({ message: 'Invalid pagination parameters.' });
        }

        // --- Fetch Paginated Data ---
        // Pass the pagination parameters to the service
        const notifications = await notificationsService.getNotificationsForUser(userId, limit, offset);

        // --- ETag/Caching removal for simplicity and correctness with pagination ---
        // The ETag logic is removed here as the response body changes with every page/offset.
        
        res.status(200).json({
            data: notifications,
            meta: {
                limit: limit,
                offset: offset,
                // Add a useful flag for the client
                hasMore: notifications.length === limit 
            }
        });
        
    } catch (error) {
        console.error('Get Paginated Notifications Error:', error);
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