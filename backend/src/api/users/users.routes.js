const express = require('express');
const usersController = require('./users.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();
const rateLimit = require('express-rate-limit');

const analyticsService = require('../analytics/analytics.service');

const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Max 30 requests per authenticated user (since authMiddleware runs first)
  message: { message: "Too many search requests. Please try again in one minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authMiddleware); // This applies authMiddleware to ALL routes below this line

// MODIFIED: No need for authMiddleware here, as it's applied by router.use
router.post('/fcm-token', usersController.handleUpdateFcmToken);

// NEW: Route to remove FCM token (set to NULL)
router.post('/fcm-token-remove', usersController.handleRemoveFCMToken);

// GET a user's own profile
router.get('/profile', usersController.handleGetUserProfile);
// UPDATE a user's own profile
router.put('/profile', usersController.handleUpdateUserProfile);
router.get('/search', searchLimiter, usersController.handleSearchUsers);
router.get('/:userId/profile', usersController.handleGetPublicUserProfile);
router.get('/progress-dashboard', usersController.handleGetProgressDashboard);
router.post(
  '/profile/avatar', 
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
      submissionsByTopic,
    ] = await Promise.all([
      analyticsService.getUserSubmissionTrends(userId),
      analyticsService.getUserSubmissionsByDifficulty(userId),
      analyticsService.getUserEloRatingHistory(userId),
      analyticsService.getSubmissionsByTopic(userId),
    ]);

    res.json({
      submissionTrends,
      submissionsByDifficulty,
      eloRatingHistory,
      submissionsByTopic,
    });
  } catch (error) {
    console.error('Error fetching personal analytics:', error);
    res.status(500).json({ message: 'Error fetching personal analytics' });
  }
});

module.exports = router;