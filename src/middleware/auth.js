/**
 * Authentication Middleware
 * Handles JWT verification and authentication
 */

const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

/**
 * Verify JWT token
 */
function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this'
      );

      req.user = decoded;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    logger.error('Error verifying token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Require authentication
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Optional authentication - continues if no token, sets req.user to null
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this'
      );
      req.user = decoded;
    } catch (error) {
      // Ignore errors, continue without user
    }
  }

  next();
}

/**
 * Require specific role (for future use)
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
}

/**
 * Authenticate token (alias for verifyToken)
 */
const authenticateToken = verifyToken;

module.exports = {
  verifyToken,
  authenticateToken,
  requireAuth,
  optionalAuth,
  requireRole
};
