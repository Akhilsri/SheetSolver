const usersService = require('./users.service');

async function searchUsersController(req, res, next) {
  try {
    const { query } = req.query;
    // Assuming req.user.id is available from your authentication middleware
    const userId = req.user.id; // <-- GET THE LOGGED-IN USER'S ID

    if (!query) {
      return res.status(200).json([]); // Return empty array if no query
    }

    // Pass userId to the service function
    const users = await usersService.searchUsers(query, userId); // <-- PASS userId HERE
    res.json(users);
  } catch (error) {
    next(error);
  }
}

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
    const data = await usersService.getPublicUserProfile(userId); // The service now returns an object
    if (!data) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetProgressDashboard(req, res) {
  try {
    const userId = req.user.userId;
    const dashboardData = await usersService.getProgressDashboard(userId);
    res.status(200).json(dashboardData);
  } catch (error) {
    console.error("Get Dashboard Error:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleUpdateAvatar(req, res) {
  try {
    console.log('--- SERVER: handleUpdateAvatar controller hit ---');
    const userId = req.user.userId;
    const file = req.file;

    if (!file) {
      console.log('--- SERVER: No image file was provided in the request. ---');
      return res.status(400).json({ message: 'No image file provided.' });
    }
    
    console.log('--- SERVER: File received. Calling updateAvatar service... ---');
    const result = await usersService.updateAvatar(userId, file);
    console.log('--- SERVER: Avatar update successful. ---');
    res.status(200).json(result);
  } catch (error) {
    console.error("--- SERVER ERROR in handleUpdateAvatar:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

// Update the exports
module.exports = { searchUsersController,handleUpdateFcmToken, handleGetUserProfile, handleUpdateUserProfile,handleSearchUsers,handleGetPublicUserProfile,handleGetProgressDashboard ,handleUpdateAvatar };