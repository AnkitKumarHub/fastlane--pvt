/**
 * Application Constants
 * Centralized configuration and constant values
 */

module.exports = {
  // Conversation Status
  CONVERSATION_STATUS: {
    AI_ONLY: 'AI_ONLY',
    LIVE_AGENT: 'LIVE_AGENT',
    CLOSED: 'CLOSED'
  },

  // Message Directions
  MESSAGE_DIRECTION: {
    INBOUND: 'inbound',
    OUTBOUND_AI: 'outbound_ai',
    OUTBOUND_AGENT: 'outbound_agent'
  },

  // Media Types
  MEDIA_TYPES: {
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    DOCUMENT: 'document',
    STICKER: 'sticker',
    VOICE: 'voice'
  },

  // Supported File Extensions
  SUPPORTED_EXTENSIONS: {
    IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    VIDEO: ['mp4', 'avi', 'mov', 'wmv', '3gp'],
    AUDIO: ['mp3', 'wav', 'aac', 'ogg', 'm4a'],
    DOCUMENT: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']
  },

  // WhatsApp Limits
  WHATSAPP_LIMITS: {
    MESSAGE_LENGTH: 4096,
    MEDIA_SIZE: {
      IMAGE: 5 * 1024 * 1024,        // 5MB
      VIDEO: 16 * 1024 * 1024,       // 16MB
      AUDIO: 16 * 1024 * 1024,       // 16MB
      DOCUMENT: 100 * 1024 * 1024,   // 100MB
      VOICE: 16 * 1024 * 1024        // 16MB
    }
  },

  // Database Configuration
  DATABASE: {
    COLLECTIONS: {
      USERS: 'whatsappUsers',
      CONVERSATIONS: 'whatsappConversations'
    },
    INDEXES: {
      USERS: ['whatsappId', 'conversationStatus', 'isActive', 'updatedAt'],
      CONVERSATIONS: ['conversationId', 'messages.whatsappMessageId', 'createdAt']
    },
    CONNECTION_POOL: {
      MAX_SIZE: 10,
      MIN_SIZE: 2,
      MAX_IDLE_TIME: 30000,
      SERVER_SELECTION_TIMEOUT: 5000
    }
  },

  // Firebase Storage
  FIREBASE: {
    MEDIA_PATH_PREFIX: 'bertWhatsappCollection',
    PUBLIC_ACCESS: true,
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    ALLOWED_MIME_TYPES: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/quicktime',
      'audio/mpeg', 'audio/wav', 'audio/aac',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  },

  // AI Service Configuration
  AI_SERVICE: {
    TIMEOUT: 30000,               // 30 seconds
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,            // 1 second
    MAX_CONTEXT_LENGTH: 4000      // Characters
  },

  // Performance Thresholds
  PERFORMANCE: {
    DB_QUERY_TIMEOUT: 5000,       // 5 seconds
    API_RESPONSE_TIMEOUT: 10000,  // 10 seconds
    MEDIA_UPLOAD_TIMEOUT: 30000,  // 30 seconds
    MAX_CONCURRENT_REQUESTS: 50
  },

  // Validation Rules
  VALIDATION: {
    WHATSAPP_ID: {
      MIN_LENGTH: 10,
      MAX_LENGTH: 15,
      PATTERN: /^\d+$/
    },
    PHONE_NUMBER: {
      PATTERN: /^(\+?)(\d{1,3})(\d{4,14})$/  // Optional + prefix, more lenient
    },
    MESSAGE_ID: {
      MIN_LENGTH: 10,
      MAX_LENGTH: 150,
      PATTERN: /^[a-zA-Z0-9._\-=+/]+$/
    }
  },

  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    REQUEST_TIMEOUT: 408,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  },

  // Error Codes
  ERROR_CODES: {
    // Database Errors
    DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
    DB_QUERY_FAILED: 'DB_QUERY_FAILED',
    DB_VALIDATION_ERROR: 'DB_VALIDATION_ERROR',
    
    // WhatsApp Errors
    WHATSAPP_INVALID_MESSAGE: 'WHATSAPP_INVALID_MESSAGE',
    WHATSAPP_API_ERROR: 'WHATSAPP_API_ERROR',
    WHATSAPP_WEBHOOK_ERROR: 'WHATSAPP_WEBHOOK_ERROR',
    
    // AI Service Errors
    AI_SERVICE_TIMEOUT: 'AI_SERVICE_TIMEOUT',
    AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
    AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
    
    // Media Errors
    MEDIA_UPLOAD_FAILED: 'MEDIA_UPLOAD_FAILED',
    MEDIA_INVALID_TYPE: 'MEDIA_INVALID_TYPE',
    MEDIA_SIZE_EXCEEDED: 'MEDIA_SIZE_EXCEEDED',
    MEDIA_SERVICE_ERROR: 'MEDIA_SERVICE_ERROR',
    
    // General Errors
    INVALID_INPUT: 'INVALID_INPUT',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    REQUEST_TIMEOUT: 'REQUEST_TIMEOUT'
  },

  // Rate Limiting
  RATE_LIMITS: {
    MESSAGES_PER_MINUTE: 60,
    API_CALLS_PER_MINUTE: 100,
    MEDIA_UPLOADS_PER_HOUR: 50
  },

  // Pagination
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    DEFAULT_OFFSET: 0
  },

  // Date Formats
  DATE_FORMATS: {
    ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
    DISPLAY: 'YYYY-MM-DD HH:mm:ss',
    LOG: 'YYYY-MM-DD HH:mm:ss.SSS'
  }
};