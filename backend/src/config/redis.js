const { createClient } = require('redis');
require('dotenv').config();

// Create the Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis successfully!');
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Connect to the Redis server. We do this once when the app starts.
redisClient.connect();

module.exports = redisClient;