/**
 * Main API Entry Point
 * Express server with all routes and middleware
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const passport = require('./passport-config');
const { logger } = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');
const requestLogger = require('./middleware/requestLogger');

// Import routes
const authRoutes = require('./routes/auth');
const projectsRoutes = require('./routes/projects');
const runsRoutes = require('./routes/runs');
const workflowsRoutes = require('./routes/workflows');
const templatesRoutes = require('./routes/templates');
const scheduledWorkflowsRoutes = require('./routes/scheduledWorkflows');
const notificationsRoutes = require('./routes/notifications');
const sharingRoutes = require('./routes/sharing');

// Initialize Express app
const app = express();

// Security middleware
// HSTS disabled: the app is served over plain HTTP inside the container
// (TLS terminates at the host's reverse proxy, which adds its own HSTS).
// Sending HSTS over http:// breaks direct port access — browsers force-HTTPS
// assets and fail with ERR_SSL_PROTOCOL_ERROR.
app.use(helmet({
  strictTransportSecurity: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      // helmet adds upgrade-insecure-requests by default; it breaks asset
      // loading on the plain-HTTP direct port the same way HSTS does.
      upgradeInsecureRequests: null,
    },
  },
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
});

app.use('/api', limiter);

// Session configuration (simplified for JWT-based auth)
app.use((req, res, next) => {
  req.session = {
    user: req.user,
    save: (cb) => cb(),
    destroy: (cb) => cb(),
    destroySession: (cb) => cb()
  };
  next();
});

// Passport configuration
app.use(passport.initialize());

// Request logging
app.use(requestLogger);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware to add db to request
app.use((req, res, next) => {
  req.db = prisma;
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
logger.info('Mounting auth routes at /api/auth');
app.use('/api/auth', authRoutes);

logger.info('Mounting projects routes at /api/projects');
app.use('/api/projects', authenticateToken, projectsRoutes);

logger.info('Mounting runs routes at /api/runs');
app.use('/api/runs', authenticateToken, runsRoutes);

logger.info('Mounting workflows routes at /api/workflows');
app.use('/api/workflows', authenticateToken, workflowsRoutes);

logger.info('Mounting workflows routes at /api/projects/:projectId/workflows');
app.use('/api/projects/:projectId/workflows', authenticateToken, workflowsRoutes);

logger.info('Mounting scheduled-workflows routes at /api/scheduled-workflows');
app.use('/api/scheduled-workflows', authenticateToken, scheduledWorkflowsRoutes);

logger.info('Mounting notifications routes at /api/notifications');
app.use('/api/notifications', authenticateToken, notificationsRoutes);

logger.info('Mounting sharing routes at /api/workflow-sharing');
app.use('/api/workflow-sharing', authenticateToken, sharingRoutes);

logger.info('Mounting templates routes at /api/templates');
app.use('/api/templates', templatesRoutes);

logger.info('All routes mounted');

// Production: serve static frontend files + SPA fallback (React Router)
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const frontendDist = path.join(__dirname, '../frontend/dist');

  // Serve static files from frontend/dist
  app.use(express.static(frontendDist));

  // SPA fallback: catch all non-API routes and serve index.html
  app.get('*', (req, res) => {
    // Prevent API routes from falling through to index.html
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler (catches all remaining requests)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Only start the HTTP server when run directly (not when required by tests)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Closing HTTP server');
    server.close(async () => {
      logger.info('HTTP server closed');
      await prisma.$disconnect();
      logger.info('Database connection closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;
