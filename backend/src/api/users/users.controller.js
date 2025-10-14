const usersService = require('./users.service');

async function searchUsersController(req, res, next) {
  try {
    const { query } = req.query;
    const userId = req.user.userId; // Corrected to req.user.userId

    if (!query) {
      return res.status(200).json([]);
    }

    const users = await usersService.searchUsers(query, userId);
    res.json(users);
  } catch (error) {
    next(error);
  }
}

async function handleUpdateFcmToken(req, res) {
  try {
    const userId = req.user.userId;
    const { fcmToken } = req.body; // MODIFIED: Changed to fcmToken to match client
    if (!fcmToken) { // MODIFIED: Check for fcmToken
      return res.status(400).json({ message: 'FCM token is required.' });
    }
    await usersService.updateFcmToken(userId, fcmToken);
    res.status(200).json({ message: 'FCM token updated.' }); // MODIFIED: Message updated
  } catch (error) {
    console.error('Update FCM Token Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

// NEW: Controller to handle removing FCM token (setting to NULL)
async function handleRemoveFCMToken(req, res) {
  try {
    const userId = req.user.userId; // Get userId from authenticated user
    // No token is sent in the body for removal, just the userId from the auth token is enough.

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    await usersService.removeFCMToken(userId); // Call the new service function
    res.status(200).json({ message: 'FCM token removed successfully.' });
  } catch (error) {
    console.error('Remove FCM Token Error:', error);
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
    const { query } = req.query;
    const currentUserId = req.user.userId;

    if (!query || query.trim() === '') {
      return res.status(200).json([]);
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
    const data = await usersService.getPublicUserProfile(userId);
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

// Update the exports to include the new controller
module.exports = { 
  searchUsersController,
  handleUpdateFcmToken, 
  handleRemoveFCMToken, // NEWLY ADDED
  handleGetUserProfile, 
  handleUpdateUserProfile,
  handleSearchUsers,
  handleGetPublicUserProfile,
  handleGetProgressDashboard,
  handleUpdateAvatar 
};