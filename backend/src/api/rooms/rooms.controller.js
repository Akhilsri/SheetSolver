const roomsService = require('./rooms.service');

async function handleCreateRoom(req, res) {
  try {
    const { name } = req.body;
    const adminId = req.user.userId;
    if (!name) {
      return res.status(400).json({ message: 'Room name is required.' });
    }
    const newRoom = await roomsService.createRoom(name, adminId);
    res.status(201).json(newRoom);
  } catch (error) {
    console.error('Create Room Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetRooms(req, res) {
  try {
    const userId = req.user.userId;
    const rooms = await roomsService.getRoomsForUser(userId);
    res.status(200).json(rooms);
  } catch (error) {
    console.error('Get Rooms Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleJoinRoom(req, res) {
  try {
    const { invite_code } = req.body;
    const userId = req.user.userId;
    if (!invite_code) {
      return res.status(400).json({ message: 'Invite code is required.' });
    }
    await roomsService.joinRoomByInviteCode(invite_code, userId);
    res.status(200).json({ message: 'Successfully joined room' });
  } catch (error) {
    console.error('Join Room Error:', error);
    if (error.message === 'ROOM_NOT_FOUND') {
      return res.status(404).json({ message: 'Room with this invite code not found.' });
    }
    if (error.message === 'ALREADY_IN_ROOM') {
      return res.status(409).json({ message: 'You are already a member of this room.' });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetRoomMembers(req, res) {
  try {
    const { roomId } = req.params;
    const members = await roomsService.getRoomMembers(roomId);
    res.status(200).json(members);
  } catch (error) {
    console.error('Get Room Members Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetRoomById(req, res) {
  try {
    const { roomId } = req.params;
    const room = await roomsService.getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }
    res.status(200).json(room);
  } catch (error) {
    console.error('Get Room By ID Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleStartJourney(req, res) {
  try {
    const { roomId } = req.params;
    const { sheetId, duration } = req.body;
    if (!sheetId || !duration) {
      return res.status(400).json({ message: 'Sheet ID and duration are required.' });
    }
    // The service now returns the updated room, so we capture it here
    const updatedRoom = await roomsService.startJourney(roomId, sheetId, duration);
    // Send the updated room back to the frontend
    res.status(200).json(updatedRoom);
  } catch (error) {
    console.error('Start Journey Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetDailyProblems(req, res) {
  try {
    const { roomId } = req.params;
    const problems = await roomsService.getDailyProblems(roomId);
    res.status(200).json(problems);
  } catch (error) {
    console.error('Get Daily Problems Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetLeaderboard(req, res) {
  try {
    const { roomId } = req.params;
    const leaderboard = await roomsService.getLeaderboard(roomId);
    res.status(200).json(leaderboard);
  } catch (error) {
    console.error("Get Leaderboard Error:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetFullSheet(req, res) {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;
    const problems = await roomsService.getFullSheetForUser(roomId, userId);
    res.status(200).json(problems);
  } catch (error) {
    console.error("Get Full Sheet Error:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleRemoveMember(req, res) {
  try {
    const { roomId, memberId } = req.params;
    const adminId = req.user.userId; // The ID of the user making the request

    const result = await roomsService.removeMember(roomId, memberId, adminId);

    if (result.affectedRows === 0) {
      // This could mean the user was not in the room to begin with.
      return res.status(404).json({ message: 'Member not found in this room.' });
    }
    
    res.status(200).json({ message: 'Member removed successfully.' });
  } catch (error) {
    if (error.message === 'ADMIN_CANNOT_REMOVE_SELF') {
      return res.status(400).json({ message: 'Admin cannot remove themselves from the room.' });
    }
    console.error("Remove Member Error:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetPendingJoinRequests(req, res) {
  try {
    const { roomId } = req.params;
    const requests = await roomsService.getPendingJoinRequests(roomId);
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleApproveJoinRequest(req, res) {
  try {
    const { requestId } = req.params;
    await roomsService.approveJoinRequest(requestId);
    res.status(200).json({ message: 'Request approved.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleDenyJoinRequest(req, res) {
  try {
    const { requestId } = req.params;
    await roomsService.denyJoinRequest(requestId);
    res.status(200).json({ message: 'Request denied.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleLeaveRoom(req, res) {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;
    const result = await roomsService.leaveRoom(roomId, userId);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'You are not a member of this room.' });
    }
    res.status(200).json({ message: 'You have left the room.' });
  } catch (error) {
    if (error.message === 'ADMIN_CANNOT_LEAVE') {
      return res.status(400).json({ message: 'Admin cannot leave the room. You must delete it instead.' });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleDeleteRoom(req, res) {
  try {
    const { roomId } = req.params;
    const adminId = req.user.userId; // The admin's ID comes from the token
    const result = await roomsService.deleteRoom(roomId, adminId);
    if (result.affectedRows === 0) {
      // This means either the room didn't exist or the user was not the admin.
      return res.status(404).json({ message: 'Room not found or you are not the admin.' });
    }
    res.status(200).json({ message: 'Room deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = {
  handleCreateRoom,
  handleGetRooms,
  handleJoinRoom,
  handleGetRoomMembers,
  handleGetRoomById,
  handleStartJourney,
  handleGetDailyProblems,
  handleGetLeaderboard,
  handleGetFullSheet,
   handleRemoveMember,
   handleGetPendingJoinRequests, handleApproveJoinRequest, handleDenyJoinRequest,
   handleLeaveRoom,
   handleDeleteRoom
};