/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */

const logger = require('../utils/logger');
const constants = require('../utils/constants');

class ErrorHandler {
  /**
   * Express error handling middleware
   */
  static handleError(error, req, res, next) {
    const timestamp = new Date().toISOString();
    const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);

    // Log the error
    logger.error('ErrorHandler', `Request failed`, {
      requestId,
      method: req.method,
      url: req.url,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      headers: req.headers,
      body: req.method !== 'GET' ? req.body : undefined
    });

    // Determine error type and response
    const errorResponse = ErrorHandler.formatErrorResponse(error, requestId);

    // Send error response
    res.status(errorResponse.status).json(errorResponse);
  }

  /**
   * Format error response based on error type
   */
  static formatErrorResponse(error, requestId) {
    const timestamp = new Date().toISOString();
    
    // Default error response
    let response = {
      success: false,
      error: {
        message: 'Internal server error',
        code: constants.ERROR_CODES.INTERNAL_SERVER_ERROR,
        requestId,
        timestamp
      },
      status: constants.HTTP_STATUS.INTERNAL_SERVER_ERROR
    };

    // Handle specific error types
    if (error.name === 'ValidationError' || error.message.includes('validation')) {
      response = {
        success: false,
        error: {
          message: error.message,
          code: constants.ERROR_CODES.DB_VALIDATION_ERROR,
          details: error.errors || null,
          requestId,
          timestamp
        },
        status: constants.HTTP_STATUS.BAD_REQUEST
      };
    }
    
    else if (error.name === 'CastError' || error.message.includes('Cast to')) {
      response = {
        success: false,
        error: {
          message: 'Invalid data format',
          code: constants.ERROR_CODES.INVALID_INPUT,
          requestId,
          timestamp
        },
        status: constants.HTTP_STATUS.BAD_REQUEST
      };
    }
    
    else if (error.code === 11000) { // MongoDB duplicate key error
      response = {
        success: false,
        error: {
          message: 'Resource already exists',
          code: constants.ERROR_CODES.RESOURCE_CONFLICT,
          requestId,
          timestamp
        },
        status: constants.HTTP_STATUS.CONFLICT
      };
    }
    
    else if (error.message.includes('not found')) {
      response = {
        success: false,
        error: {
          message: error.message,
          code: constants.ERROR_CODES.RESOURCE_NOT_FOUND,
          requestId,
          timestamp
        },
        status: constants.HTTP_STATUS.NOT_FOUND
      };
    }
    
    else if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
      response = {
        success: false,
        error: {
          message: 'Request timeout',
          code: constants.ERROR_CODES.REQUEST_TIMEOUT,
          requestId,
          timestamp
        },
        status: constants.HTTP_STATUS.REQUEST_TIMEOUT
      };
    }
    
    else if (error.message.includes('Firebase') || error.message.includes('Storage')) {
      response = {
        success: false,
        error: {
          message: 'Media service error',
          code: constants.ERROR_CODES.MEDIA_SERVICE_ERROR,
          requestId,
          timestamp
        },
        status: constants.HTTP_STATUS.SERVICE_UNAVAILABLE
      };
    }
    
    else if (error.message.includes('WhatsApp') || error.message.includes('webhook')) {
      response = {
        success: false,
        error: {
          message: 'WhatsApp service error',
          code: constants.ERROR_CODES.WHATSAPP_API_ERROR,
          requestId,
          timestamp
        },
        status: constants.HTTP_STATUS.BAD_REQUEST
      };
    }
    
    else if (error.message.includes('AI') || error.message.includes('checkpoint')) {
      response = {
        success: false,
        error: {
          message: 'AI service error',
          code: constants.ERROR_CODES.AI_SERVICE_ERROR,
          requestId,
          timestamp
        },
        status: constants.HTTP_STATUS.SERVICE_UNAVAILABLE
      };
    }

    // In development, include stack trace
    if (process.env.NODE_ENV === 'development') {
      response.error.stack = error.stack;
    }

    return response;
  }

  /**
   * Handle async errors in route handlers
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Handle unhandled promise rejections
   */
  static handleUnhandledRejection(reason, promise) {
    logger.error('ErrorHandler', 'Unhandled Promise Rejection', {
      reason: reason.message || reason,
      stack: reason.stack,
      promise: promise.toString()
    });

    // Graceful shutdown
    process.exit(1);
  }

  /**
   * Handle uncaught exceptions
   */
  static handleUncaughtException(error) {
    logger.error('ErrorHandler', 'Uncaught Exception', {
      message: error.message,
      stack: error.stack
    });

    // Graceful shutdown
    process.exit(1);
  }

  /**
   * Validate request data middleware
   */
  static validateRequest(requiredFields = []) {
    return (req, res, next) => {
      try {
        const missingFields = [];
        const requestData = { ...req.body, ...req.query, ...req.params };

        requiredFields.forEach(field => {
          if (!requestData[field]) {
            missingFields.push(field);
          }
        });

        if (missingFields.length > 0) {
          const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
          error.code = constants.ERROR_CODES.INVALID_INPUT;
          throw error;
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Rate limiting error handler
   */
  static handleRateLimit(req, res) {
    const response = {
      success: false,
      error: {
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        requestId: req.headers['x-request-id'] || Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        retryAfter: 60 // seconds
      }
    };

    logger.warn('ErrorHandler', 'Rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent')
    });

    res.status(429).json(response);
  }

  /**
   * 404 handler for unknown routes
   */
  static handle404(req, res) {
    const response = {
      success: false,
      error: {
        message: `Route ${req.method} ${req.url} not found`,
        code: constants.ERROR_CODES.RESOURCE_NOT_FOUND,
        requestId: req.headers['x-request-id'] || Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString()
      }
    };

    logger.warn('ErrorHandler', '404 - Route not found', {
      method: req.method,
      url: req.url,
      ip: req.ip
    });

    res.status(404).json(response);
  }

  /**
   * Setup global error handlers
   */
  static setupGlobalHandlers() {
    process.on('unhandledRejection', ErrorHandler.handleUnhandledRejection);
    process.on('uncaughtException', ErrorHandler.handleUncaughtException);

    logger.info('ErrorHandler', 'Global error handlers registered');
  }
}

module.exports = ErrorHandler;