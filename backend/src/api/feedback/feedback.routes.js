const express = require('express');
const feedbackController = require('./feedback.controller');
// const authMiddleware = require('../../middlewares/auth.middleware'); // Optional: require user to be logged in

const router = express.Router();

// You might want to allow unauthenticated feedback for wider reach,
// or use authMiddleware if you only want feedback from logged-in users.
router.post('/', feedbackController.handlePostFeedback);

module.exports = router;