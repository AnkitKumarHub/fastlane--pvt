/**
 * Logger Utility
 * Provides consistent console logging with timestamps and formatting
 */

class Logger {
  constructor() {
    this.logLevels = {
      ERROR: '❌',
      WARN: '⚠️',
      INFO: 'ℹ️',
      SUCCESS: '✅',
      DEBUG: '🐛'
    };
  }

  /**
   * Get formatted timestamp
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message with consistent structure
   */
  formatMessage(level, component, message, data = null) {
    const timestamp = this.getTimestamp();
    const emoji = this.logLevels[level] || 'ℹ️';
    const componentTag = component ? `[${component}]` : '';
    
    let logMessage = `${emoji} ${timestamp} ${componentTag} ${message}`;
    
    if (data) {
      logMessage += `\n📊 Data: ${JSON.stringify(data, null, 2)}`;
    }
    
    return logMessage;
  }

  /**
   * Log info messages
   */
  info(component, message, data = null) {
    const formattedMessage = this.formatMessage('INFO', component, message, data);
    console.log(formattedMessage);
  }

  /**
   * Log success messages
   */
  success(component, message, data = null) {
    const formattedMessage = this.formatMessage('SUCCESS', component, message, data);
    console.log(formattedMessage);
  }

  /**
   * Log error messages
   */
  error(component, message, error = null) {
    const errorData = error ? {
      message: error.message,
      stack: error.stack,
      code: error.code || 'UNKNOWN'
    } : null;
    
    const formattedMessage = this.formatMessage('ERROR', component, message, errorData);
    console.error(formattedMessage);
  }

  /**
   * Log warning messages
   */
  warn(component, message, data = null) {
    const formattedMessage = this.formatMessage('WARN', component, message, data);
    console.warn(formattedMessage);
  }

  /**
   * Log debug messages (only in development)
   */
  debug(component, message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      const formattedMessage = this.formatMessage('DEBUG', component, message, data);
      console.debug(formattedMessage);
    }
  }

  /**
   * Log database operations
   */
  database(operation, collection, details = null) {
    this.info('DB', `${operation} operation on ${collection}`, details);
  }

  /**
   * Log WhatsApp webhook events
   */
  webhook(event, whatsappId, details = null) {
    this.info('WhatsApp', `${event} event for user ${whatsappId}`, details);
  }

  /**
   * Log AI processing events
   */
  ai(operation, whatsappId, processingTime = null, details = null) {
    const aiData = {
      whatsappId,
      processingTimeMs: processingTime,
      ...details
    };
    this.info('AI', `${operation}`, aiData);
  }

  /**
   * Log media operations
   */
  media(operation, fileName, fileSize = null, details = null) {
    const mediaData = {
      fileName,
      fileSizeBytes: fileSize,
      ...details
    };
    this.info('Media', `${operation}`, mediaData);
  }

  /**
   * Log performance metrics
   */
  performance(operation, duration, details = null) {
    const perfData = {
      operation,
      durationMs: duration,
      ...details
    };
    this.info('Performance', `Operation completed in ${duration}ms`, perfData);
  }

  /**
   * Log user activities
   */
  user(action, whatsappId, details = null) {
    const userData = {
      whatsappId,
      action,
      ...details
    };
    this.info('User', `User ${action}`, userData);
  }

  /**
   * Log system startup information
   */
  startup(component, message, config = null) {
    this.success('Startup', `${component}: ${message}`, config);
  }

  /**
   * Log API calls
   */
  api(method, endpoint, statusCode = null, responseTime = null) {
    const apiData = {
      method,
      endpoint,
      statusCode,
      responseTimeMs: responseTime
    };
    this.info('API', `${method} ${endpoint}`, apiData);
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;