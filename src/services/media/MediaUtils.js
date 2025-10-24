/**
 * Media Utils
 * Utility functions for media processing and type detection
 */

const constants = require('../../utils/constants');
const path = require('path');

class MediaUtils {
  
  /**
   * Get media type from MIME type
   * @param {string} mimeType - MIME type of the file
   * @returns {string} - Media type (image, video, audio, etc.)
   */
  static getMediaType(mimeType) {
    if (!mimeType || typeof mimeType !== 'string') {
      throw new Error('Invalid MIME type provided');
    }
    
    const mimeTypeLower = mimeType.toLowerCase();
    
    // Image types
    if (mimeTypeLower.startsWith('image/')) {
      if (mimeTypeLower === 'image/webp') {
        // WebP can be either image or sticker, default to image
        return constants.MEDIA_TYPES.IMAGE;
      }
      return constants.MEDIA_TYPES.IMAGE;
    }
    
    // Video types
    if (mimeTypeLower.startsWith('video/')) {
      return constants.MEDIA_TYPES.VIDEO;
    }
    
    // Audio types
    if (mimeTypeLower.startsWith('audio/')) {
      // Special handling for WhatsApp voice messages
      if (mimeTypeLower === 'audio/ogg' || mimeTypeLower.includes('opus')) {
        return constants.MEDIA_TYPES.VOICE;
      }
      return constants.MEDIA_TYPES.AUDIO;
    }
    
    // Document types
    if (mimeTypeLower.startsWith('application/') || mimeTypeLower.startsWith('text/')) {
      return constants.MEDIA_TYPES.DOCUMENT;
    }
    
    throw new Error(`Unsupported MIME type: ${mimeType}`);
  }
  
  /**
   * Get file extension from filename or MIME type
   * @param {string} filename - Filename with extension
   * @param {string} mimeType - MIME type (fallback if filename has no extension)
   * @returns {string} - File extension without dot
   */
  static getFileExtension(filename, mimeType = null) {
    if (!filename) {
      throw new Error('Filename is required');
    }
    
    // Try to get extension from filename
    const ext = path.extname(filename).slice(1).toLowerCase();
    if (ext) {
      return ext;
    }
    
    // Fallback to MIME type mapping
    if (mimeType) {
      return this.getExtensionFromMimeType(mimeType);
    }
    
    throw new Error('Could not determine file extension');
  }
  
  /**
   * Get file extension from MIME type
   * @param {string} mimeType - MIME type
   * @returns {string} - File extension
   */
  static getExtensionFromMimeType(mimeType) {
    const mimeToExtMap = {
      // Images
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      
      // Videos
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      
      // Audio
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/aac': 'aac',
      'audio/ogg': 'ogg',
      'audio/opus': 'opus',
      'audio/mp4': 'm4a',
      
      // Documents
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'text/plain': 'txt'
    };
    
    const extension = mimeToExtMap[mimeType.toLowerCase()];
    if (!extension) {
      throw new Error(`No extension mapping for MIME type: ${mimeType}`);
    }
    
    return extension;
  }
  
  /**
   * Validate file extension against media type
   * @param {string} extension - File extension
   * @param {string} mediaType - Media type
   * @returns {boolean} - Whether extension is valid for media type
   */
  static isValidExtensionForMediaType(extension, mediaType) {
    const ext = extension.toLowerCase();
    const validExtensions = constants.SUPPORTED_EXTENSIONS[mediaType.toUpperCase()];
    
    return validExtensions && validExtensions.includes(ext);
  }
  
  /**
   * Check if MIME type is supported
   * @param {string} mimeType - MIME type to check
   * @returns {boolean} - Whether MIME type is supported
   */
  static isSupportedMimeType(mimeType) {
    return constants.FIREBASE.ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase());
  }
  
  /**
   * Get maximum file size for media type
   * @param {string} mediaType - Media type
   * @returns {number} - Maximum file size in bytes
   */
  static getMaxFileSize(mediaType) {
    const limits = constants.WHATSAPP_LIMITS.MEDIA_SIZE;
    
    switch (mediaType.toLowerCase()) {
      case constants.MEDIA_TYPES.IMAGE:
        return limits.IMAGE;
      case constants.MEDIA_TYPES.VIDEO:
        return limits.VIDEO;
      case constants.MEDIA_TYPES.AUDIO:
      case constants.MEDIA_TYPES.VOICE:
        return limits.AUDIO;
      case constants.MEDIA_TYPES.DOCUMENT:
        return limits.DOCUMENT;
      case constants.MEDIA_TYPES.STICKER:
        return limits.IMAGE; // Stickers use image limits
      default:
        return constants.FIREBASE.MAX_FILE_SIZE;
    }
  }
  
  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} - Formatted file size
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Generate unique filename to prevent collisions
   * @param {string} originalFilename - Original filename
   * @param {string} messageId - WhatsApp message ID
   * @param {number} timestamp - Timestamp
   * @returns {string} - Unique filename
   */
  static generateUniqueFilename(originalFilename, messageId, timestamp) {
    const extension = this.getFileExtension(originalFilename);
    const baseName = path.basename(originalFilename, '.' + extension);
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '');
    
    return `${cleanBaseName}_${messageId}_${timestamp}.${extension}`;
  }
  
  /**
   * Extract metadata from media info
   * @param {Object} mediaInfo - Media information object
   * @returns {Object} - Extracted metadata
   */
  static extractMetadata(mediaInfo) {
    const metadata = {
      mimeType: mediaInfo.mimeType,
      fileSize: mediaInfo.fileSize || (mediaInfo.buffer ? mediaInfo.buffer.length : 0),
      fileName: mediaInfo.filename || mediaInfo.fileName,
      uploadedAt: new Date().toISOString()
    };
    
    // Add media-specific metadata
    if (mediaInfo.dimensions) {
      metadata.dimensions = mediaInfo.dimensions;
    }
    
    if (mediaInfo.duration) {
      metadata.duration = mediaInfo.duration;
    }
    
    return metadata;
  }
  
  /**
   * Check if file is WhatsApp compatible
   * @param {string} mimeType - MIME type
   * @param {string} mediaType - Media type
   * @returns {Object} - Compatibility info
   */
  static checkWhatsAppCompatibility(mimeType, mediaType) {
    const isSupported = this.isSupportedMimeType(mimeType);
    const maxSize = this.getMaxFileSize(mediaType);
    
    let warnings = [];
    
    // Video-specific warnings
    if (mediaType === constants.MEDIA_TYPES.VIDEO) {
      if (!['video/mp4', 'video/3gpp'].includes(mimeType.toLowerCase())) {
        warnings.push('Video format may not be supported by WhatsApp');
      }
    }
    
    // Audio-specific warnings
    if (mediaType === constants.MEDIA_TYPES.VOICE) {
      if (mimeType.toLowerCase() !== 'audio/ogg') {
        warnings.push('Voice message format may not be optimal for WhatsApp');
      }
    }
    
    return {
      isSupported,
      maxSize,
      warnings,
      recommendation: warnings.length > 0 ? 'Consider converting to WhatsApp-preferred format' : 'Fully compatible'
    };
  }
  
  /**
   * Detect media type from WhatsApp message object
   * @param {Object} message - WhatsApp message object
   * @returns {string|null} - Detected media type
   */
  static detectMediaTypeFromMessage(message) {
    if (!message || typeof message !== 'object') {
      return null;
    }
    
    // Check for different media types in WhatsApp message structure
    if (message.image) return constants.MEDIA_TYPES.IMAGE;
    if (message.video) return constants.MEDIA_TYPES.VIDEO;
    if (message.audio) return constants.MEDIA_TYPES.AUDIO;
    if (message.voice) return constants.MEDIA_TYPES.VOICE;
    if (message.document) return constants.MEDIA_TYPES.DOCUMENT;
    if (message.sticker) return constants.MEDIA_TYPES.STICKER;
    if (message.location) return constants.MEDIA_TYPES.LOCATION;
    if (message.contacts) return constants.MEDIA_TYPES.CONTACT;
    
    return null;
  }
}

module.exports = MediaUtils;