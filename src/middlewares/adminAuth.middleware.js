const pool = require('../config/db');

async function adminAuthMiddleware(req, res, next) {
  try {
    const userId = req.user.userId; // From the regular authMiddleware
    const { roomId } = req.params;

    const [rows] = await pool.query('SELECT admin_id FROM rooms WHERE id = ?', [roomId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    if (rows[0].admin_id !== userId) {
      return res.status(403).json({ message: 'Forbidden. Only the room admin can perform this action.' });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = adminAuthMiddleware;