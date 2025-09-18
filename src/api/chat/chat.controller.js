const chatService = require('./chat.service');

async function handleGetChatHistory(req, res) {
  try {
    const { roomId } = req.params;
    const history = await chatService.getChatHistory(roomId);
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetDirectMessageHistory(req, res) {
  try {
    const currentUserId = req.user.userId;
    const { connectionUserId } = req.params;
    const history = await chatService.getDirectMessageHistory(currentUserId, connectionUserId);
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetUnreadCount(req, res) {
  try {
    // Get the logged-in user's ID from the token (which was verified by the authMiddleware)
    const userId = req.user.userId;
    
    // Call the service function to get the count from the database
    const countObject = await chatService.getUnreadDirectMessageCount(userId);
    
    // Send the result (e.g., { "count": 5 }) back as JSON
    res.status(200).json(countObject);
  } catch (error) {
    console.error("Get Unread DM Count Error:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleMarkAsRead(req, res) {
  try {
    const currentUserId = req.user.userId;
    const { senderId } = req.params;
    await chatService.markDirectMessagesAsRead(currentUserId, senderId);
    res.status(200).json({ message: 'OK' });
  } catch (error) { res.status(500).json({ message: 'Internal Server Error' }); }
}

module.exports = { handleGetChatHistory,handleGetDirectMessageHistory,handleMarkAsRead,handleGetUnreadCount };