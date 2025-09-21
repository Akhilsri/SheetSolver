const express = require('express');
const badgesController = require('./badges.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const router = express.Router();
router.get('/my-badges', authMiddleware, badgesController.handleGetEarnedBadges);
module.exports = router;