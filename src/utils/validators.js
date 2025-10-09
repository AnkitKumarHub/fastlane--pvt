/**
 * Validation Utilities
 * Provides input validation and sanitization functions
 */

const constants = require('./constants');
const logger = require('./logger');

class Validator {
  constructor() {
    this.patterns = constants.VALIDATION;
  }

  /**
   * Validate WhatsApp ID
   */
  validateWhatsappId(whatsappId) {
    if (!whatsappId) {
      throw new Error('WhatsApp ID is required');
    }

    if (typeof whatsappId !== 'string') {
      throw new Error('WhatsApp ID must be a string');
    }

    if (whatsappId.length < this.patterns.WHATSAPP_ID.MIN_LENGTH || 
        whatsappId.length > this.patterns.WHATSAPP_ID.MAX_LENGTH) {
      throw new Error(`WhatsApp ID must be between ${this.patterns.WHATSAPP_ID.MIN_LENGTH} and ${this.patterns.WHATSAPP_ID.MAX_LENGTH} characters`);
    }

    if (!this.patterns.WHATSAPP_ID.PATTERN.test(whatsappId)) {
      throw new Error('WhatsApp ID must contain only digits');
    }

    return true;
  }

  /**
   * Validate phone number (E.164 format)
   */
  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber) {
      return true; // Phone number is optional
    }

    if (typeof phoneNumber !== 'string') {
      throw new Error('Phone number must be a string');
    }

    if (!this.patterns.PHONE_NUMBER.PATTERN.test(phoneNumber)) {
      throw new Error('Phone number must be a valid international format (e.g., +1234567890 or 1234567890)');
    }

    return true;
  }

  /**
   * Validate message ID
   */
  validateMessageId(messageId) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    if (typeof messageId !== 'string') {
      throw new Error('Message ID must be a string');
    }

    if (messageId.length < this.patterns.MESSAGE_ID.MIN_LENGTH || 
        messageId.length > this.patterns.MESSAGE_ID.MAX_LENGTH) {
      throw new Error(`Message ID must be between ${this.patterns.MESSAGE_ID.MIN_LENGTH} and ${this.patterns.MESSAGE_ID.MAX_LENGTH} characters`);
    }

    if (!this.patterns.MESSAGE_ID.PATTERN.test(messageId)) {
      throw new Error('Message ID contains invalid characters');
    }

    return true;
  }

  /**
   * Validate conversation status
   */
  validateConversationStatus(status) {
    if (!status) {
      return true; // Status is optional, will default to AI_ONLY
    }

    const validStatuses = Object.values(constants.CONVERSATION_STATUS);
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid conversation status. Must be one of: ${validStatuses.join(', ')}`);
    }

    return true;
  }

  /**
   * Validate message direction
   */
  validateMessageDirection(direction) {
    if (!direction) {
      throw new Error('Message direction is required');
    }

    const validDirections = Object.values(constants.MESSAGE_DIRECTION);
    if (!validDirections.includes(direction)) {
      throw new Error(`Invalid message direction. Must be one of: ${validDirections.join(', ')}`);
    }

    return true;
  }

  /**
   * Validate media type
   */
  validateMediaType(mediaType) {
    if (!mediaType) {
      return true; // Media type is optional
    }

    const validTypes = Object.values(constants.MEDIA_TYPES);
    if (!validTypes.includes(mediaType)) {
      throw new Error(`Invalid media type. Must be one of: ${validTypes.join(', ')}`);
    }

    return true;
  }

  /**
   * Validate file extension
   */
  validateFileExtension(extension, mediaType) {
    if (!extension || !mediaType) {
      return true; // Optional validation
    }

    const validExtensions = constants.SUPPORTED_EXTENSIONS[mediaType.toUpperCase()];
    if (!validExtensions || !validExtensions.includes(extension.toLowerCase())) {
      throw new Error(`Invalid file extension '${extension}' for media type '${mediaType}'`);
    }

    return true;
  }

  /**
   * Validate file size
   */
  validateFileSize(fileSize, mediaType) {
    if (!fileSize || !mediaType) {
      return true; // Optional validation
    }

    const maxSize = constants.WHATSAPP_LIMITS.MEDIA_SIZE[mediaType.toUpperCase()];
    if (!maxSize) {
      throw new Error(`Unknown media type: ${mediaType}`);
    }

    if (fileSize > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      throw new Error(`File size exceeds limit. Maximum ${maxSizeMB}MB allowed for ${mediaType}`);
    }

    return true;
  }

  /**
   * Validate text content length
   */
  validateTextContent(textContent) {
    if (!textContent) {
      return true; // Text content is optional
    }

    if (typeof textContent !== 'string') {
      throw new Error('Text content must be a string');
    }

    if (textContent.length > constants.WHATSAPP_LIMITS.MESSAGE_LENGTH) {
      throw new Error(`Message too long. Maximum ${constants.WHATSAPP_LIMITS.MESSAGE_LENGTH} characters allowed`);
    }

    return true;
  }

  /**
   * Validate timestamp
   */
  validateTimestamp(timestamp) {
    if (!timestamp) {
      return true; // Timestamp is optional, will default to current time
    }

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid timestamp format');
    }

    // Check if timestamp is not in the future (with 1 minute tolerance)
    const now = new Date();
    const oneMinuteFromNow = new Date(now.getTime() + 60000);
    if (date > oneMinuteFromNow) {
      throw new Error('Timestamp cannot be in the future');
    }

    return true;
  }

  /**
   * Sanitize string input
   */
  sanitizeString(input, maxLength = null) {
    if (!input || typeof input !== 'string') {
      return input;
    }

    // Remove control characters and normalize whitespace
    let sanitized = input
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Truncate if maxLength specified
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
      logger.warn('Validator', `String truncated to ${maxLength} characters`);
    }

    return sanitized;
  }

  /**
   * Validate and sanitize user input for creating a user
   */
  validateUserInput(userData) {
    const errors = [];

    try {
      this.validateWhatsappId(userData.whatsappId);
    } catch (error) {
      errors.push(`WhatsApp ID: ${error.message}`);
    }

    try {
      this.validatePhoneNumber(userData.phoneNumber);
    } catch (error) {
      errors.push(`Phone Number: ${error.message}`);
    }

    try {
      this.validateConversationStatus(userData.conversationStatus);
    } catch (error) {
      errors.push(`Conversation Status: ${error.message}`);
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Sanitize string fields
    return {
      whatsappId: this.sanitizeString(userData.whatsappId),
      displayName: this.sanitizeString(userData.displayName, 100),
      phoneNumber: this.sanitizeString(userData.phoneNumber),
      conversationStatus: userData.conversationStatus || constants.CONVERSATION_STATUS.AI_ONLY,
      isActive: userData.isActive !== undefined ? Boolean(userData.isActive) : true
    };
  }

  /**
   * Validate and sanitize message input
   */
  validateMessageInput(messageData) {
    const errors = [];

    try {
      this.validateMessageId(messageData.whatsappMessageId);
    } catch (error) {
      errors.push(`Message ID: ${error.message}`);
    }

    try {
      this.validateMessageDirection(messageData.direction);
    } catch (error) {
      errors.push(`Direction: ${error.message}`);
    }

    try {
      this.validateTextContent(messageData.textContent);
    } catch (error) {
      errors.push(`Text Content: ${error.message}`);
    }

    try {
      this.validateTimestamp(messageData.timestamp);
    } catch (error) {
      errors.push(`Timestamp: ${error.message}`);
    }

    if (messageData.mediaData) {
      try {
        this.validateMediaType(messageData.mediaData.type);
        this.validateFileExtension(messageData.mediaData.fileName?.split('.').pop(), messageData.mediaData.type);
        this.validateFileSize(messageData.mediaData.fileSize, messageData.mediaData.type);
      } catch (error) {
        errors.push(`Media: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Message validation failed: ${errors.join(', ')}`);
    }

    // Sanitize and return validated data
    return {
      whatsappMessageId: this.sanitizeString(messageData.whatsappMessageId),
      direction: messageData.direction,
      timestamp: messageData.timestamp ? new Date(messageData.timestamp) : new Date(),
      textContent: this.sanitizeString(messageData.textContent, constants.WHATSAPP_LIMITS.MESSAGE_LENGTH),
      mediaData: messageData.mediaData ? {
        type: messageData.mediaData.type,
        url: this.sanitizeString(messageData.mediaData.url),
        mimeType: this.sanitizeString(messageData.mediaData.mimeType),
        fileName: this.sanitizeString(messageData.mediaData.fileName),
        fileSize: messageData.mediaData.fileSize
      } : undefined,
      aiAudit: messageData.aiAudit ? {
        checkpointId: this.sanitizeString(messageData.aiAudit.checkpointId),
        processingTimeMs: Number(messageData.aiAudit.processingTimeMs) || 0
      } : undefined
    };
  }
}

// Create singleton instance
const validator = new Validator();

module.exports = validator;