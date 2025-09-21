const connectionsService = require('./connections.service');

async function handleSendRequest(req, res) {
  try {
    const senderId = req.user.userId;
    const { recipientId } = req.body;
    if (senderId === recipientId) {
      return res.status(400).json({ message: "You cannot send a connection request to yourself." });
    }
    await connectionsService.sendConnectionRequest(senderId, recipientId);
    res.status(201).json({ message: 'Connection request sent.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A connection or request already exists with this user.' });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetPendingRequests(req, res) {
  try {
    const userId = req.user.userId;
    const requests = await connectionsService.getPendingRequests(userId);
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleAcceptRequest(req, res) {
  try {
    const { requestId } = req.params;
    const userId = req.user.userId;
    await connectionsService.acceptConnectionRequest(requestId, userId);
    res.status(200).json({ message: 'Connection accepted.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleDeclineRequest(req, res) {
  try {
    const { requestId } = req.params;
    const userId = req.user.userId;
    await connectionsService.declineConnectionRequest(requestId, userId);
    res.status(200).json({ message: 'Connection request declined.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetConnectionStatus(req, res) {
  try {
    const currentUserId = req.user.userId;
    const { profileUserId } = req.params;
    const status = await connectionsService.getConnectionStatus(currentUserId, profileUserId);
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetConnections(req, res) {
  try {
    const userId = req.user.userId;
    const connections = await connectionsService.getConnections(userId);
    res.status(200).json(connections);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleRemoveConnection(req, res) {
  try {
    const currentUserId = req.user.userId;
    const { friendId } = req.params;
    const result = await connectionsService.removeConnection(currentUserId, friendId);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Connection not found.' });
    }
    res.status(200).json({ message: 'Connection removed.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = { handleSendRequest, handleGetPendingRequests, handleAcceptRequest, handleDeclineRequest,handleGetConnectionStatus,handleGetConnections,handleRemoveConnection };