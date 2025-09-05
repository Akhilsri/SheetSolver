const express = require('express');
const multer = require('multer');
const submissionsController = require('./submissions.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = express.Router();

// Configure multer to store files in memory as buffers
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Define the POST route
router.post(
  '/',
  authMiddleware, // 1. First, check if the user is logged in
  upload.single('proofImage'), // 2. Then, handle the single file upload with the field name 'proofImage'
  submissionsController.handleCreateSubmission // 3. Finally, run our controller logic
);

router.get(
  '/room/:roomId/today', 
  authMiddleware, 
  submissionsController.handleGetTodaysSubmissions
);

module.exports = router;