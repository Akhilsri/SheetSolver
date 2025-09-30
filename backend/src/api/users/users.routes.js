const express = require('express');
const usersController = require('./users.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

const analyticsService = require('../analytics/analytics.service');

router.use(authMiddleware);

router.post('/fcm-token', authMiddleware, usersController.handleUpdateFcmToken);

// GET a user's own profile
router.get('/profile', authMiddleware, usersController.handleGetUserProfile);
// UPDATE a user's own profile
router.put('/profile', authMiddleware, usersController.handleUpdateUserProfile);
router.get('/search', authMiddleware, usersController.handleSearchUsers);
router.get('/:userId/profile', authMiddleware, usersController.handleGetPublicUserProfile);
router.get('/progress-dashboard', authMiddleware, usersController.handleGetProgressDashboard);
router.post(
  '/profile/avatar', 
  authMiddleware, // <-- This was the missing piece
  upload.single('avatar'), 
  usersController.handleUpdateAvatar
);

router.get('/analytics/personal', async (req, res) => {
  try {
    const userId = req.user.userId;
    const [
      submissionTrends,
      submissionsByDifficulty,
      eloRatingHistory,
      submissionsByTopic, // <-- Fetch new data
    ] = await Promise.all([
      analyticsService.getUserSubmissionTrends(userId),
      analyticsService.getUserSubmissionsByDifficulty(userId),
      analyticsService.getUserEloRatingHistory(userId),
      analyticsService.getSubmissionsByTopic(userId), // <-- Call new service function
    ]);

    res.json({
      submissionTrends,
      submissionsByDifficulty,
      eloRatingHistory,
      submissionsByTopic, // <-- Add to response
    });
  } catch (error) {
    console.error('Error fetching personal analytics:', error);
    res.status(500).json({ message: 'Error fetching personal analytics' });
  }
});

module.exports = router;