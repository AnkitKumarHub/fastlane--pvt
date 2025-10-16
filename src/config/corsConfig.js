/**
 * CORS Configuration Service
 * Modular CORS setup for different environments
 * Handles cross-origin requests from Harmony Platform
 */

const logger = require('../utils/logger');

class CorsConfig {
  
  /**
   * Get CORS configuration based on environment
   * @returns {Object} CORS configuration object
   */
  static getCorsOptions() {
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    // Get Harmony Platform URLs from environment
    const harmonyDevUrl = process.env.HARMONY_PLATFORM_URL_DEV || 'http://localhost:3000';
    const harmonyProdUrl = process.env.HARMONY_PLATFORM_URL_PROD || 'https://harmony-prod.yourcompany.com';
    
    let corsOptions;
    
    if (nodeEnv === 'development') {
      // Development: Allow all origins for easy testing
      corsOptions = {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['*'],
        credentials: true,
        optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
        preflightContinue: false
      };
      
      logger.info('CorsConfig', 'CORS configured for DEVELOPMENT - allowing all origins');
      
    } else if (nodeEnv === 'production') {
      // Production: Restrict to specific Harmony Platform URLs
      const allowedOrigins = [
        harmonyProdUrl,
        // Add additional production URLs if needed
        'https://harmony.yourcompany.com',
        'https://admin.yourcompany.com'
      ];
      
      corsOptions = {
        origin: (origin, callback) => {
          // Allow requests with no origin (like mobile apps or Postman)
          if (!origin) return callback(null, true);
          
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            logger.warn('CorsConfig', 'CORS blocked request from unauthorized origin', { origin });
            callback(new Error('Not allowed by CORS policy'), false);
          }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-API-Key',
          'X-User-ID',
          'X-Request-ID',
          'X-Client-Version',
          'Accept',
          'Origin',
          'User-Agent'
        ],
        credentials: true,
        optionsSuccessStatus: 200,
        preflightContinue: false
      };
      
      logger.info('CorsConfig', 'CORS configured for PRODUCTION', { 
        allowedOrigins: allowedOrigins.length 
      });
      
    } else {
      // Staging or other environments: Similar to production but with staging URLs
      const allowedOrigins = [
        harmonyDevUrl,
        harmonyProdUrl,
        'http://localhost:3000',
        'https://harmony-staging.yourcompany.com'
      ];
      
      corsOptions = {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['*'],
        credentials: true,
        optionsSuccessStatus: 200,
        preflightContinue: false
      };
      
      logger.info('CorsConfig', `CORS configured for ${nodeEnv.toUpperCase()}`, { 
        allowedOrigins: allowedOrigins.length 
      });
    }
    
    return corsOptions;
  }
  
  /**
   * Get allowed origins for current environment
   * @returns {Array|String} Allowed origins
   */
  static getAllowedOrigins() {
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    if (nodeEnv === 'development') {
      return '*';
    }
    
    const harmonyDevUrl = process.env.HARMONY_PLATFORM_URL_DEV || 'http://localhost:3000';
    const harmonyProdUrl = process.env.HARMONY_PLATFORM_URL_PROD || 'https://harmony-prod.yourcompany.com';
    
    return nodeEnv === 'production' 
      ? [harmonyProdUrl, 'https://harmony.yourcompany.com']
      : [harmonyDevUrl, harmonyProdUrl, 'http://localhost:3000'];
  }
  
  /**
   * Log CORS configuration info
   */
  static logConfiguration() {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const allowedOrigins = this.getAllowedOrigins();
    
    logger.info('CorsConfig', 'CORS Configuration Summary', {
      environment: nodeEnv,
      allowedOrigins: Array.isArray(allowedOrigins) ? allowedOrigins : ['ALL'],
      harmonyDevUrl: process.env.HARMONY_PLATFORM_URL_DEV,
      harmonyProdUrl: process.env.HARMONY_PLATFORM_URL_PROD
    });
  }
  
  /**
   * Validate environment configuration
   * @returns {Object} Validation result
   */
  static validateConfiguration() {
    const errors = [];
    const warnings = [];
    
    // Check if environment URLs are set
    if (!process.env.HARMONY_PLATFORM_URL_DEV) {
      warnings.push('HARMONY_PLATFORM_URL_DEV not set, using default: http://localhost:3000');
    }
    
    if (!process.env.HARMONY_PLATFORM_URL_PROD) {
      warnings.push('HARMONY_PLATFORM_URL_PROD not set, using default production URL');
    }
    
    // Check NODE_ENV
    const validEnvs = ['development', 'staging', 'production'];
    const currentEnv = process.env.NODE_ENV || 'development';
    
    if (!validEnvs.includes(currentEnv)) {
      warnings.push(`NODE_ENV "${currentEnv}" not recognized, CORS may not work as expected`);
    }
    
    // Log validation results
    if (warnings.length > 0) {
      logger.warn('CorsConfig', 'Configuration warnings', { warnings });
    }
    
    if (errors.length > 0) {
      logger.error('CorsConfig', 'Configuration errors', { errors });
    } else {
      logger.success('CorsConfig', 'Configuration validation passed');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = CorsConfig;