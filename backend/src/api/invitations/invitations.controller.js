const invitationsService = require('./invitations.service');

async function handleCreateInvitation(req, res) {
  try {
    const senderId = req.user.userId;
    const { recipientId, roomId } = req.body;
    await invitationsService.createInvitation(senderId, recipientId, roomId);
    res.status(201).json({ message: 'Invitation sent successfully.' });
  } catch (error) {
    console.error('Create Invitation Error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'An invitation to this room already exists for this user.' });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetPendingInvitations(req, res) {
  try {
    const recipientId = req.user.userId;
    const invitations = await invitationsService.getPendingInvitations(recipientId);
    res.status(200).json(invitations);
  } catch (error) {
    console.error('Get Pending Invitations Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleAcceptInvitation(req, res) {
  try {
    const { invitationId } = req.params;
    const recipientId = req.user.userId;
    await invitationsService.acceptInvitation(invitationId, recipientId);
    res.status(200).json({ message: 'Invitation accepted successfully.' });
  } catch (error) {
    console.error('Accept Invitation Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleDeclineInvitation(req, res) {
  try {
    const { invitationId } = req.params;
    const recipientId = req.user.userId;
    await invitationsService.declineInvitation(invitationId, recipientId);
    res.status(200).json({ message: 'Invitation declined successfully.' });
  } catch (error) {
    console.error('Decline Invitation Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

async function handleGetSentPendingInvites(req, res) {
  try {
    const senderId = req.user.userId;
    const { recipientId } = req.query; // e.g., /sent-pending?recipientId=15
    const pendingRoomIds = await invitationsService.getSentPendingInvites(senderId, recipientId);
    res.status(200).json(pendingRoomIds);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = { handleCreateInvitation, handleGetPendingInvitations, handleAcceptInvitation, handleDeclineInvitation,handleGetSentPendingInvites };