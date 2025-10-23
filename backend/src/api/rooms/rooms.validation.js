const pool = require('../../config/db');

const validateRoomAdmin = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId; // This is set by your authMiddleware

    if (!roomId) {
      return res.status(400).json({ message: 'Room ID is required.' });
    }

    const [rooms] = await pool.query(
      'SELECT admin_id FROM rooms WHERE id = ?',
      [roomId]
    );

    if (rooms.length === 0) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const room = rooms[0];

    if (Number(room.admin_id) !== Number(userId)) {
      return res.status(403).json({ message: 'Forbidden: You are not the admin of this room.' });
    }

    // If all checks pass, proceed to the next function (the controller)
    next();
  } catch (error) {
    console.error('Admin validation error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  validateRoomAdmin,
};