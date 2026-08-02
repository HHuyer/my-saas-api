/**
 * Logger Utility
 * Centralized logging with file and console output
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const logFile = path.join(logsDir, 'app.log');

/**
 * Log levels
 */
const levels = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Create log message
 */
function createMessage(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data })
  };
  return JSON.stringify(logEntry) + '\n';
}

/**
 * Write to file
 */
function writeToFile(message) {
  try {
    fs.appendFileSync(logFile, message);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

/**
 * Logger class
 */
class Logger {
  constructor(name) {
    this.name = name;
  }

  error(message, data = null) {
    const fullMessage = `[${this.name}] ${message}`;
    console.error(fullMessage, data || '');
    writeToFile(createMessage(levels.ERROR, fullMessage, data));
  }

  warn(message, data = null) {
    const fullMessage = `[${this.name}] ${message}`;
    console.warn(fullMessage, data || '');
    writeToFile(createMessage(levels.WARN, fullMessage, data));
  }

  info(message, data = null) {
    const fullMessage = `[${this.name}] ${message}`;
    console.log(fullMessage, data || '');
    writeToFile(createMessage(levels.INFO, fullMessage, data));
  }

  debug(message, data = null) {
    const fullMessage = `[${this.name}] ${message}`;
    console.log(fullMessage, data || '');
    writeToFile(createMessage(levels.DEBUG, fullMessage, data));
  }
}

// Create default logger instance
const logger = new Logger('API');

module.exports = { logger, Logger };
