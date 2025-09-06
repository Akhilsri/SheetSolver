const usersService = require('./users.service');

async function handleUpdateFcmToken(req, res) {
  try {
    const userId = req.user.userId;
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Token is required.' });
    }
    await usersService.updateFcmToken(userId, token);
    res.status(200).json({ message: 'Token updated.' });
  } catch (error) {
    console.error('Update FCM Token Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetUserProfile(req, res) {
  try {
    const userId = req.user.userId;
    const profile = await usersService.getUserProfile(userId);
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleUpdateUserProfile(req, res) {
  try {
    const userId = req.user.userId;
    await usersService.updateUserProfile(userId, req.body);
    res.status(200).json({ message: 'Profile updated.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleSearchUsers(req, res) {
  try {
    const { query } = req.query; // Get search term from query parameters (e.g., /search?query=akhil)
    const currentUserId = req.user.userId;

    if (!query || query.trim() === '') {
      return res.status(200).json([]); // Return empty if query is empty
    }

    const users = await usersService.searchUsers(query, currentUserId);
    res.status(200).json(users);
  } catch (error) {
    console.error("Search Users Error:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetPublicUserProfile(req, res) {
  try {
    const { userId } = req.params;
    const profile = await usersService.getPublicUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

// Update the exports
module.exports = { handleUpdateFcmToken, handleGetUserProfile, handleUpdateUserProfile,handleSearchUsers,handleGetPublicUserProfile };