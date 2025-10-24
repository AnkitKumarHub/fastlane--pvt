/**
 * Media Validator
 * Validates media files for WhatsApp compatibility and security
 */

const constants = require('../../utils/constants');
const MediaUtils = require('./MediaUtils');
const logger = require('../../utils/logger');

class MediaValidator {
  
  /**
   * Validate media file comprehensively
   * @param {Object} mediaInfo - Media information object
   * @param {Buffer} mediaInfo.buffer - File buffer
   * @param {string} mediaInfo.mimeType - MIME type
   * @param {string} mediaInfo.filename - Original filename
   * @param {number} [mediaInfo.fileSize] - File size (optional, will be calculated from buffer)
   * @returns {Object} - Validation result
   */
  static validateMedia(mediaInfo) {
    try {
      // Basic input validation
      this.validateBasicInputs(mediaInfo);
      
      // Get media type
      const mediaType = MediaUtils.getMediaType(mediaInfo.mimeType);
      
      // Validate MIME type
      this.validateMimeType(mediaInfo.mimeType);
      
      // Validate file size
      this.validateFileSize(mediaInfo.buffer.length, mediaType);
      
      // Validate file extension
      this.validateFileExtension(mediaInfo.filename, mediaType);
      
      // WhatsApp compatibility check
      const compatibility = MediaUtils.checkWhatsAppCompatibility(mediaInfo.mimeType, mediaType);
      
      // Security validation
      this.validateSecurity(mediaInfo, mediaType);
      
      logger.debug('MediaValidator', 'Media validation successful', {
        mediaType,
        fileSize: mediaInfo.buffer.length,
        mimeType: mediaInfo.mimeType,
        filename: mediaInfo.filename
      });
      
      return {
        isValid: true,
        mediaType,
        compatibility,
        fileSize: mediaInfo.buffer.length,
        warnings: compatibility.warnings || []
      };
      
    } catch (error) {
      logger.error('MediaValidator', `Media validation failed: ${error.message}`, {
        mimeType: mediaInfo?.mimeType,
        filename: mediaInfo?.filename,
        fileSize: mediaInfo?.buffer?.length
      });
      
      return {
        isValid: false,
        error: error.message,
        mediaType: null
      };
    }
  }
  
  /**
   * Validate basic inputs
   * @param {Object} mediaInfo - Media information object
   */
  static validateBasicInputs(mediaInfo) {
    if (!mediaInfo || typeof mediaInfo !== 'object') {
      throw new Error('Media info object is required');
    }
    
    if (!mediaInfo.buffer || !Buffer.isBuffer(mediaInfo.buffer)) {
      throw new Error('Valid file buffer is required');
    }
    
    if (!mediaInfo.mimeType || typeof mediaInfo.mimeType !== 'string') {
      throw new Error('MIME type is required');
    }
    
    if (!mediaInfo.filename || typeof mediaInfo.filename !== 'string') {
      throw new Error('Filename is required');
    }
    
    if (mediaInfo.buffer.length === 0) {
      throw new Error('File buffer cannot be empty');
    }
  }
  
  /**
   * Validate MIME type
   * @param {string} mimeType - MIME type to validate
   */
  static validateMimeType(mimeType) {
    if (!MediaUtils.isSupportedMimeType(mimeType)) {
      throw new Error(`Unsupported MIME type: ${mimeType}`);
    }
  }
  
  /**
   * Validate file size against limits
   * @param {number} fileSize - File size in bytes
   * @param {string} mediaType - Media type
   */
  static validateFileSize(fileSize, mediaType) {
    // Check against maximum file size
    if (fileSize > constants.FIREBASE.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${MediaUtils.formatFileSize(constants.FIREBASE.MAX_FILE_SIZE)}`);
    }
    
    // Check against media-specific limits
    const maxSize = MediaUtils.getMaxFileSize(mediaType);
    if (fileSize > maxSize) {
      throw new Error(`${mediaType} file size exceeds WhatsApp limit of ${MediaUtils.formatFileSize(maxSize)}`);
    }
    
    // Minimum size check (prevent empty files)
    if (fileSize < 100) { // 100 bytes minimum
      throw new Error('File size too small - file may be corrupted');
    }
  }
  
  /**
   * Validate file extension against media type
   * @param {string} filename - Filename with extension
   * @param {string} mediaType - Media type
   */
  static validateFileExtension(filename, mediaType) {
    try {
      const extension = MediaUtils.getFileExtension(filename);
      
      if (!MediaUtils.isValidExtensionForMediaType(extension, mediaType)) {
        const validExtensions = constants.SUPPORTED_EXTENSIONS[mediaType.toUpperCase()];
        throw new Error(`Invalid file extension '${extension}' for ${mediaType}. Supported: ${validExtensions.join(', ')}`);
      }
      
    } catch (error) {
      throw new Error(`File extension validation failed: ${error.message}`);
    }
  }
  
  /**
   * Validate security aspects of the file
   * @param {Object} mediaInfo - Media information object
   * @param {string} mediaType - Media type
   */
  static validateSecurity(mediaInfo, mediaType) {
    // Check for suspicious file names
    this.validateFilename(mediaInfo.filename);
    
    // Basic file signature validation
    this.validateFileSignature(mediaInfo.buffer, mediaInfo.mimeType);
    
    // Check for potentially dangerous content
    this.validateContent(mediaInfo.buffer, mediaType);
  }
  
  /**
   * Validate filename for security
   * @param {string} filename - Filename to validate
   */
  static validateFilename(filename) {
    // Check for directory traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error('Filename contains invalid characters');
    }
    
    // Check for suspicious extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.js', '.vbs', '.jar'];
    const extension = '.' + MediaUtils.getFileExtension(filename);
    
    if (dangerousExtensions.includes(extension.toLowerCase())) {
      throw new Error(`Potentially dangerous file extension: ${extension}`);
    }
    
    // Check filename length
    if (filename.length > 255) {
      throw new Error('Filename too long');
    }
  }
  
  /**
   * Validate file signature (magic numbers)
   * @param {Buffer} buffer - File buffer
   * @param {string} mimeType - Expected MIME type
   */
  static validateFileSignature(buffer, mimeType) {
    if (buffer.length < 8) {
      return; // Too small to check signature
    }
    
    const signatures = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'image/webp': [0x52, 0x49, 0x46, 0x46],
      'video/mp4': [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp
      'application/pdf': [0x25, 0x50, 0x44, 0x46] // %PDF
    };
    
    const expectedSignature = signatures[mimeType.toLowerCase()];
    if (expectedSignature) {
      const fileSignature = Array.from(buffer.slice(0, expectedSignature.length));
      
      // For MP4, check for ftyp box at offset 4
      if (mimeType.toLowerCase() === 'video/mp4') {
        const ftypSignature = Array.from(buffer.slice(4, 8));
        if (!this.arraysEqual(ftypSignature, [0x66, 0x74, 0x79, 0x70])) {
          logger.warn('MediaValidator', 'MP4 file signature mismatch - file may be corrupted');
        }
      } else if (!this.arraysEqual(fileSignature, expectedSignature)) {
        throw new Error(`File signature does not match MIME type ${mimeType}`);
      }
    }
  }
  
  /**
   * Validate file content for security
   * @param {Buffer} buffer - File buffer
   * @param {string} mediaType - Media type
   */
  static validateContent(buffer, mediaType) {
    // Check for embedded executables or scripts
    const suspiciousPatterns = [
      Buffer.from('eval('),
      Buffer.from('<script'),
      Buffer.from('javascript:'),
      Buffer.from('MZ'), // PE executable header
      Buffer.from('#!/bin/sh'),
      Buffer.from('#!/bin/bash')
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (buffer.includes(pattern)) {
        logger.warn('MediaValidator', 'Suspicious content detected in file', {
          mediaType,
          pattern: pattern.toString()
        });
        // Don't throw error, just log warning for now
      }
    }
    
    // Media-specific content validation
    if (mediaType === constants.MEDIA_TYPES.DOCUMENT) {
      this.validateDocumentContent(buffer);
    }
  }
  
  /**
   * Validate document content
   * @param {Buffer} buffer - Document buffer
   */
  static validateDocumentContent(buffer) {
    // Check for macros in Office documents (simplified check)
    if (buffer.includes(Buffer.from('macros')) || buffer.includes(Buffer.from('VBA'))) {
      logger.warn('MediaValidator', 'Document may contain macros');
    }
  }
  
  /**
   * Helper function to compare arrays
   * @param {Array} arr1 - First array
   * @param {Array} arr2 - Second array
   * @returns {boolean} - Whether arrays are equal
   */
  static arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, index) => val === arr2[index]);
  }
  
  /**
   * Validate WhatsApp-specific message structure
   * @param {Object} message - WhatsApp message object
   * @returns {Object} - Validation result
   */
  static validateWhatsAppMessage(message) {
    try {
      if (!message || typeof message !== 'object') {
        throw new Error('Invalid message object');
      }
      
      const mediaType = MediaUtils.detectMediaTypeFromMessage(message);
      if (!mediaType) {
        throw new Error('No media detected in message');
      }
      
      // Validate message structure based on media type
      this.validateMessageStructure(message, mediaType);
      
      return {
        isValid: true,
        mediaType,
        mediaId: this.extractMediaId(message, mediaType)
      };
      
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }
  
  /**
   * Validate WhatsApp message structure
   * @param {Object} message - WhatsApp message object
   * @param {string} mediaType - Media type
   */
  static validateMessageStructure(message, mediaType) {
    const requiredFields = {
      [constants.MEDIA_TYPES.IMAGE]: ['image.id', 'image.mime_type'],
      [constants.MEDIA_TYPES.VIDEO]: ['video.id', 'video.mime_type'],
      [constants.MEDIA_TYPES.AUDIO]: ['audio.id', 'audio.mime_type'],
      [constants.MEDIA_TYPES.VOICE]: ['voice.id', 'voice.mime_type'],
      [constants.MEDIA_TYPES.DOCUMENT]: ['document.id', 'document.mime_type'],
      [constants.MEDIA_TYPES.STICKER]: ['sticker.id', 'sticker.mime_type']
    };
    
    const fields = requiredFields[mediaType];
    if (!fields) {
      return; // No validation for this media type
    }
    
    for (const field of fields) {
      const value = this.getNestedProperty(message, field);
      if (!value) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }
  
  /**
   * Extract media ID from WhatsApp message
   * @param {Object} message - WhatsApp message object
   * @param {string} mediaType - Media type
   * @returns {string|null} - Media ID
   */
  static extractMediaId(message, mediaType) {
    const idPaths = {
      [constants.MEDIA_TYPES.IMAGE]: 'image.id',
      [constants.MEDIA_TYPES.VIDEO]: 'video.id',
      [constants.MEDIA_TYPES.AUDIO]: 'audio.id',
      [constants.MEDIA_TYPES.VOICE]: 'voice.id',
      [constants.MEDIA_TYPES.DOCUMENT]: 'document.id',
      [constants.MEDIA_TYPES.STICKER]: 'sticker.id'
    };
    
    const idPath = idPaths[mediaType];
    return idPath ? this.getNestedProperty(message, idPath) : null;
  }
  
  /**
   * Get nested property from object using dot notation
   * @param {Object} obj - Object to search
   * @param {string} path - Dot-separated path
   * @returns {*} - Property value or null
   */
  static getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }
}

module.exports = MediaValidator;