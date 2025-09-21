const express = require('express');
const quizController = require('./quiz.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const router = express.Router();

router.get('/topics', authMiddleware, quizController.handleGetAvailableTopics);

module.exports = router;