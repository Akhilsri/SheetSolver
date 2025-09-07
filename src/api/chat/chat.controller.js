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
module.exports = { handleGetChatHistory };