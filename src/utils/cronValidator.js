/**
 * Cron Expression Validator
 * Validates cron expressions for the scheduler
 */

/**
 * Validate cron expression format
 * Basic validation - checks if it's a valid cron expression
 */
function validateCronExpression(cronExpression) {
  if (!cronExpression || typeof cronExpression !== 'string') {
    return false;
  }

  // Remove comments
  const expr = cronExpression.split('#')[0].trim();

  // Split by space
  const parts = expr.split(/\s+/);

  // Basic cron structure: minute hour day-of-month month day-of-week
  if (parts.length !== 5) {
    return false;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Validate each part
  return (
    validateField(minute, 0, 59) &&
    validateField(hour, 0, 23) &&
    validateField(dayOfMonth, 1, 31) &&
    validateField(month, 1, 12) &&
    validateField(dayOfWeek, 0, 6)
  );
}

/**
 * Validate a single field in cron expression
 */
function validateField(field, min, max) {
  // Wildcard
  if (field === '*') {
    return true;
  }

  // Step pattern (e.g., */5)
  if (field.includes('*/')) {
    const [base, step] = field.split('*/').map(Number);
    return step > 0 && base >= min && base <= max && base + step <= max;
  }

  // Range (e.g., 1-10)
  if (field.includes('-')) {
    const [minVal, maxVal] = field.split('-').map(Number);
    return minVal >= min && maxVal <= max && minVal < maxVal;
  }

  // Comma separated list
  if (field.includes(',')) {
    const values = field.split(',').map(Number);
    return values.every(v => v >= min && v <= max);
  }

  // Single value
  const value = Number(field);
  return value >= min && value <= max;
}

/**
 * Get human-readable description of cron expression
 */
function getCronDescription(cronExpression) {
  if (!validateCronExpression(cronExpression)) {
    return 'Invalid cron expression';
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = cronExpression.split(/\s+/);

  const descriptions = {
    minute: parseCronPart(minute, 'minute'),
    hour: parseCronPart(hour, 'hour'),
    dayOfMonth: parseCronPart(dayOfMonth, 'day of month'),
    month: parseCronPart(month, 'month'),
    dayOfWeek: parseCronPart(dayOfWeek, 'day of week')
  };

  return descriptions;
}

/**
 * Parse a single cron field
 */
function parseCronPart(part, label) {
  if (part === '*') {
    return `every ${label}`;
  }

  if (part.includes('*/')) {
    const [base, step] = part.split('*/').map(Number);
    const unit = label.slice(0, -1); // Remove last 'e' for singular
    return `every ${step} ${unit}s starting from ${base}`;
  }

  if (part.includes('-')) {
    const [min, max] = part.split('-').map(Number);
    return `${min}-${max} ${label}`;
  }

  if (part.includes(',')) {
    const values = part.split(',').map(Number).sort((a, b) => a - b);
    const displayValues = values.join(', ');
    return displayValues;
  }

  return part;
}

/**
 * Get example cron expressions for common schedules
 */
const examples = {
  everyMinute: '*/5 * * * *', // Every 5 minutes
  hourly: '0 * * * *', // Every hour
  daily: '0 0 * * *', // Every day at midnight
  weekly: '0 0 * * 0', // Every Sunday at midnight
  monthly: '0 0 1 * *', // First of every month
  workHours: '0 9-17 * * 1-5', // Weekdays 9am-5pm
  hourly: '0 */2 * * *' // Every 2 hours
};

module.exports = {
  validateCronExpression,
  getCronDescription,
  examples
};
