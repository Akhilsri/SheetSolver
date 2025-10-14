const chatService = require('./chat.service');

async function handleGetChatHistory(req, res) {
    try {
        const { roomId } = req.params;
        // Read pagination parameters from query string
        const limit = parseInt(req.query.limit, 10) || 50;
        const beforeId = req.query.beforeId || null;

        // The service returns { messages, hasMore }
        const { messages, hasMore } = await chatService.getChatHistory(roomId, limit, beforeId);
        
        res.status(200).json({ messages, hasMore });
    } catch (error) {
        console.error("Get Chat History Error:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

async function handleGetDirectMessageHistory(req, res) {
    try {
        const currentUserId = req.user.userId;
        const { connectionUserId } = req.params;
        
        // ⚡ OPTIMIZATION: Read pagination parameters from query string
        const limit = parseInt(req.query.limit, 10) || 50;
        const beforeId = req.query.beforeId || null;

        // Pass parameters to the service layer
        const { messages, hasMore } = await chatService.getDirectMessageHistory(currentUserId, connectionUserId, limit, beforeId);

        // Return the paginated structure
        res.status(200).json({ messages, hasMore });
    } catch (error) {
        console.error("Get Direct Message History Error:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

async function handleGetUnreadCount(req, res) {
    try {
        const userId = req.user.userId;
        const countObject = await chatService.getUnreadDirectMessageCount(userId);
        res.status(200).json({ 
            count: Number(countObject.count) || 0
        });
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

module.exports = { handleGetChatHistory, handleGetDirectMessageHistory, handleMarkAsRead, handleGetUnreadCount };