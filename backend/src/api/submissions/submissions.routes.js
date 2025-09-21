const express = require('express');
const multer = require('multer');
const submissionsController = require('./submissions.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// This line applies the security middleware to ALL routes defined below it in this file.
router.use(authMiddleware);

// Route for creating a new submission (with image upload)
router.post(
  '/',
  upload.single('proofImage'),
  submissionsController.handleCreateSubmission
);

// Route for getting today's submissions for a room
router.get(
  '/room/:roomId/today', 
  submissionsController.handleGetTodaysSubmissions
);

// Route for checking the all-time solved status for a list of problems
router.post(
    '/status', 
    submissionsController.handleGetSubmissionStatus
);

module.exports = router;