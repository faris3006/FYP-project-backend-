const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid token' });
      }

      try {
        // Validate that the token matches the active session token
        const dbUser = await User.findById(user.userId);
        if (!dbUser) {
          return res.status(404).json({ message: 'User not found' });
        }

        if (dbUser.activeSessionToken !== token) {
          return res.status(403).json({ 
            message: 'Session expired or logged in from another device',
            isSessionInvalid: true
          });
        }

        req.user = user; // attach decoded token (user info) to request
        next();
      } catch (error) {
        console.error('Error in authenticateJWT:', error);
        return res.status(500).json({ message: 'Server error during authentication' });
      }
    });
  } else {
    res.status(401).json({ message: 'Authorization header missing or malformed' });
  }
};

module.exports = authenticateJWT;
