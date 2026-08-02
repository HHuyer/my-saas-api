/**
 * Request Logger Middleware
 * Logs all incoming requests with timestamp and response time
 */

const { logger } = require('../utils/logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  // Log request
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: req.body
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms`);
  });

  next();
}

module.exports = requestLogger;
