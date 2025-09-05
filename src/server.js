// 1. Import the 'app' instance from app.js
require('dotenv').config();
const app = require('./app');

// 2. Define the port the server will run on
// It will use the PORT from environment variables if available, otherwise default to 3000
const PORT = process.env.PORT || 3000;

// 3. Start the server
app.listen(PORT, () => {
  // This callback function runs once the server successfully starts
  console.log(`Server is running on http://localhost:${PORT}`);
});