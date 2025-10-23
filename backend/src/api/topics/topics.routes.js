const express = require('express');
const router = express.Router();
const topicsService = require('./topics.service'); // Assuming this exists or will be created
const authMiddleware = require('../../middlewares/auth.middleware');

router.use(authMiddleware); // All topic routes require authentication

router.get('/', async (req, res, next) => {
  try {
    const topics = await topicsService.getAllTopics();
    res.json(topics);
  } catch (error) {
    next(error);
  }
});

module.exports = router;