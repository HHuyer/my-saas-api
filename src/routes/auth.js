/**
 * Authentication Routes
 * Handles Google OAuth and user authentication
 */

const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// Test endpoint for dummy authentication
router.post('/test-login', async (req, res) => {
  try {
    const { email, name } = req.body;

    // Create or find test user in database
    let user = await req.db.user.findUnique({
      where: { email: email || 'test@example.com' }
    });

    if (!user) {
      user = await req.db.user.create({
        data: {
          email: email || 'test@example.com',
          name: name || 'Test User'
        }
      });
      logger.info(`Test user created: ${user.email}`);
    } else {
      // Ensure user has the requested name
      if (name && user.name !== name) {
        user = await req.db.user.update({
          where: { id: user.id },
          data: { name }
        });
        logger.info(`Test user name updated: ${user.email}`);
      }
      logger.info(`Test user found: ${user.email}`);
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
      { expiresIn: '7d' }
    );

    logger.info(`Test login successful: ${user.email}`);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    logger.error('Error in test login:', error);
    res.status(500).json({ error: error.message });
  }
});

// Google OAuth routes (only available if credentials are configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
    async (req, res) => {
      try {
        // Generate JWT token
        const token = jwt.sign(
          {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name
          },
          process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
          { expiresIn: '7d' }
        );

        logger.info(`User authenticated: ${req.user.email}`);

        // Redirect to frontend with token
        const frontendUrl = process.env.NODE_ENV === 'production'
          ? 'https://your-domain.com'
          : 'http://localhost:3000';

        res.redirect(`${frontendUrl}?token=${token}`);
      } catch (error) {
        logger.error('Error in Google callback:', error);
        res.redirect('/login?error=callback_failed');
      }
    }
  );
} else {
  // Provide info about test endpoint when OAuth is not configured
  router.get('/google', (req, res) => {
    res.json({
      message: 'Google OAuth not configured. Use POST /api/auth/test-login instead.',
      testEndpoint: '/api/auth/test-login',
      body: { email: 'test@example.com', name: 'Test User' }
    });
  });

  router.get('/google/callback', (req, res) => {
    res.redirect('/login?error=oauth_not_configured');
  });
}

// GitHub OAuth routes (only available if credentials are configured)
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  router.get(
    '/github',
    passport.authenticate('github', { scope: ['user:email'] })
  );

  router.get(
    '/github/callback',
    passport.authenticate('github', { failureRedirect: '/login?error=auth_failed' }),
    async (req, res) => {
      try {
        // Generate JWT token
        const token = jwt.sign(
          {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name
          },
          process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
          { expiresIn: '7d' }
        );

        logger.info(`User authenticated: ${req.user.email}`);

        // Redirect to frontend with token
        const frontendUrl = process.env.NODE_ENV === 'production'
          ? 'https://your-domain.com'
          : 'http://localhost:3000';

        res.redirect(`${frontendUrl}?token=${token}`);
      } catch (error) {
        logger.error('Error in GitHub callback:', error);
        res.redirect('/login?error=callback_failed');
      }
    }
  );
} else {
  // Provide info about test endpoint when GitHub OAuth is not configured
  router.get('/github', (req, res) => {
    res.json({
      message: 'GitHub OAuth not configured. Use POST /api/auth/test-login instead.',
      testEndpoint: '/api/auth/test-login',
      body: { email: 'test@example.com', name: 'Test User' }
    });
  });

  router.get('/github/callback', (req, res) => {
    res.redirect('/login?error=oauth_not_configured');
  });
}

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await req.db.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        projects: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    logger.error('Error fetching current user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { name, avatar } = req.body;

    const user = await req.db.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(avatar && { avatar })
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true
      }
    });

    res.json(user);
  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Logout
router.post('/logout', authenticateToken, (req, res) => {
  // In a real app, you might want to invalidate the token
  // For JWT, this is done by checking the token is invalid/expired
  logger.info(`User logged out: ${req.user.email}`);
  res.json({ success: true, message: 'Logged out successfully' });
});

// Refresh token (if you implement refresh token strategy)
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const newToken = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
      { expiresIn: '7d' }
    );

    res.json({ token: newToken });
  } catch (error) {
    logger.error('Error refreshing token:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
