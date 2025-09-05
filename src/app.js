const express = require('express');
const cors = require('cors');

// --- Import all routes ---
const authRoutes = require('./api/auth/auth.routes');
const roomRoutes = require('./api/rooms/rooms.routes');
const sheetRoutes = require('./api/sheets/sheets.routes');
const submissionRoutes = require('./api/submissions/submissions.routes'); // Corrected path
const userRoutes = require('./api/users/users.routes');
const notificationRoutes = require('./api/notifications/notifications.routes');

const app = express();

// --- Middlewares ---
app.use(cors());
app.use(express.json());


// --- Main test route ---
app.get('/', (req, res) => {
  res.status(200).json({ message: "API is live!" });
});

// --- Use the routes with a prefix ---
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/sheets', sheetRoutes);
app.use('/api/submissions', submissionRoutes); 
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

module.exports = app;