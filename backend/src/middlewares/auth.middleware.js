const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  // 1. Get the token from the Authorization header
  const authHeader = req.headers.authorization;

  // 2. Check if the token exists and is in the correct format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Middleware Error: No token or bad format.');
    return res.status(401).json({ message: 'Authentication token required.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 3. Verify the token using the secret key
    const decodedPayload = jwt.verify(token, process.env.JWT_SECRET);
  

    // 4. Attach the user's info (from the token) to the request object
    // Now, any subsequent controller can access req.user
    req.user = decodedPayload;

    // 5. Pass control to the next function in the chain (the controller)
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = authMiddleware;