const express = require('express');
const connectionsController = require('./connections.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware); // All connection routes require a user to be logged in

router.post('/request', connectionsController.handleSendRequest);
router.get('/pending', connectionsController.handleGetPendingRequests);
router.put('/:requestId/accept', connectionsController.handleAcceptRequest);
router.put('/:requestId/decline', connectionsController.handleDeclineRequest); // Using PUT for state change is also common
router.get('/status/:profileUserId', connectionsController.handleGetConnectionStatus);
router.get('/', connectionsController.handleGetConnections);
router.delete('/user/:friendId', connectionsController.handleRemoveConnection);

module.exports = router;