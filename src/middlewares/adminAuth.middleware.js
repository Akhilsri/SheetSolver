const pool = require('../config/db');

async function adminAuthMiddleware(req, res, next) {
  try {
    const userId = req.user.userId; // From the regular authMiddleware
    let roomId = req.params.roomId;

    // If roomId is not in the URL, try to find it from the requestId
    if (!roomId) {
      const { requestId } = req.params;
      if (!requestId) {
        return res.status(400).json({ message: 'Room ID or Request ID is required.' });
      }

      // Look up the roomId from the join_requests table
      const [requests] = await pool.query('SELECT room_id FROM join_requests WHERE id = ?', [requestId]);
      if (requests.length === 0) {
        return res.status(404).json({ message: 'Join request not found.' });
      }
      roomId = requests[0].room_id;
    }

    // Now that we have the roomId, perform the original admin check
    const [rows] = await pool.query('SELECT admin_id FROM rooms WHERE id = ?', [roomId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    if (rows[0].admin_id !== userId) {
      return res.status(403).json({ message: 'Forbidden. Only the room admin can perform this action.' });
    }

    next(); // All checks passed, proceed to the controller
  } catch (error) {
    console.error("Admin Auth Middleware Error:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = adminAuthMiddleware;