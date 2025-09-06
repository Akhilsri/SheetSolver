const express = require('express');
const invitationsController = require('./invitations.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/', invitationsController.handleCreateInvitation);
router.get('/pending', invitationsController.handleGetPendingInvitations);
router.put('/:invitationId/accept', invitationsController.handleAcceptInvitation);
router.put('/:invitationId/decline', invitationsController.handleDeclineInvitation);
router.get('/sent-pending', invitationsController.handleGetSentPendingInvites);

module.exports = router;