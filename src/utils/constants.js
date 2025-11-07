/**
 * Application Constants
 * Centralized configuration and constant values
 */

module.exports = {
  // Conversation Status
  CONVERSATION_STATUS: {
    AI: 'AI',
    HUMAN: 'HUMAN',
  },

  // Message Directions
  MESSAGE_DIRECTION: {
    INBOUND: 'inbound',
    OUTBOUND_AI: 'outbound_ai',
    OUTBOUND_LM: 'outbound_lm'
  },

  // Media Types
  MEDIA_TYPES: {
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    DOCUMENT: 'document',
    STICKER: 'sticker',
    VOICE: 'voice',
    LOCATION: 'location',
    CONTACT: 'contact'
  },

  // Supported File Extensions
  SUPPORTED_EXTENSIONS: {
    IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    VIDEO: ['mp4', '3gp'],                           // WhatsApp compatible only
    AUDIO: ['mp3', 'wav', 'aac', 'opus', 'ogg', 'm4a'], // Extended voice support
    DOCUMENT: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
    STICKER: ['webp'],                               // WhatsApp stickers
    VOICE: ['ogg', 'mp3', 'opus'],                  // WhatsApp + extended
    LOCATION: ['png']                                // Location thumbnail images
  },

  // Sender Types
  SENDER_TYPES: {
    USER: 'user',     // Inbound messages  
    AI: 'ai',         // AI responses
    LM: 'lm'          // LM responses
  },

  // WhatsApp Status Operations
  WHATSAPP_STATUS: {
    READ_STATUS_ENABLED: true,
    TYPING_INDICATOR_ENABLED: true,
    MAX_TYPING_DURATION: 25000,  // Meta's maximum (25 seconds)
    API_VERSION: 'v24.0'         // Required for status features
  },

  // WhatsApp Limits
  WHATSAPP_LIMITS: {
    MESSAGE_LENGTH: 4096,
    MEDIA_SIZE: {
      IMAGE: 5 * 1024 * 1024,        // 5MB
      VIDEO: 16 * 1024 * 1024,       // 16MB
      AUDIO: 16 * 1024 * 1024,       // 16MB
      DOCUMENT: 100 * 1024 * 1024,   // 100MB
      VOICE: 16 * 1024 * 1024,       // 16MB
      LOCATION: 5 * 1024 * 1024      // 5MB (thumbnail images)
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
    MEDIA_PATH_PREFIX: 'lynnWhatsappChat',          // Updated path prefix
    PUBLIC_ACCESS: true,
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    ALLOWED_MIME_TYPES: [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      // Videos (WhatsApp compatible only)
      'video/mp4', 'video/3gpp',
      // Audio (extended support)
      'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/opus', 'audio/mp4',
      // Documents
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      // Stickers
      'image/webp'
    ]
  },

  // Firebase Firestore Database 
  FIRESTORE: {
    COLLECTION_NAME: 'LynnwhatsAppChats',
    SYNC_ENABLED: process.env.ENABLE_FIRESTORE_SYNC === 'true',
    CONNECTION_TIMEOUT: 10000, // 10 seconds
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second
    BATCH_SIZE: 500, // Maximum batch operations
    MAX_DOCUMENT_SIZE: 1048576 // 1MB per document
  },

  // Welcome Message Configuration
  WELCOME_MESSAGE: {
    TEXT: "Hi, I'm Lynn — your personal concierge assistant, here to make everyday life simpler and beautifully organized.  I understand and research every detail before our concierge team takes it forward. How may I assist you today?",
    ENABLED: true
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
    },
    CLIENT_MESSAGE_ID: {
      MIN_LENGTH: 10,
      MAX_LENGTH: 100,
      PATTERN: /^[a-zA-Z0-9_\-]+$/
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
    
    // WhatsApp Status Errors
    WHATSAPP_READ_STATUS_FAILED: 'WHATSAPP_READ_STATUS_FAILED',
    WHATSAPP_TYPING_INDICATOR_FAILED: 'WHATSAPP_TYPING_INDICATOR_FAILED',
    
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