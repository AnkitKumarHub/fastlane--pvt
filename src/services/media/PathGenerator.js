/**
 * Path Generator
 * Generates structured storage paths for media files
 * Format: /lynnWhatsappChat/{whatsappId}/{YYYY}/{MM}/{senderType}/{messageType}_{messageId}_{timestamp}.{ext}
 */

const constants = require('../../utils/constants');
const path = require('path');

class PathGenerator {
  
  /**
   * Generate structured media storage path
   * @param {string} whatsappId - WhatsApp ID of the user
   * @param {string} messageId - WhatsApp message ID
   * @param {number} timestamp - Message timestamp
   * @param {string} direction - Message direction (inbound, outbound_ai, outbound_lm)
   * @param {string} messageType - Type of media (image, video, audio, etc.)
   * @param {string} filename - Original filename
   * @returns {string} - Structured storage path
   */
  static generateMediaPath(whatsappId, messageId, timestamp, direction, messageType, filename) {
    try {
      // Validate inputs
      if (!whatsappId || !messageId || !timestamp || !direction || !messageType || !filename) {
        throw new Error('All parameters are required for path generation');
      }

      // Create date components
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      
      // Get sender type from direction
      const senderType = this.getSenderType(direction);
      
      // Get file extension
      const fileExt = this.getFileExtension(filename);
      
      // Clean inputs to prevent path injection
      const cleanWhatsappId = this.sanitizePathComponent(whatsappId);
      const cleanMessageId = this.sanitizePathComponent(messageId);
      const cleanMessageType = this.sanitizePathComponent(messageType);
      
      // Generate filename: {messageType}_{messageId}_{timestamp}.{ext}
      const generatedFilename = `${cleanMessageType}_${cleanMessageId}_${timestamp}.${fileExt}`;
      
      // Build path components
      const pathComponents = [
        constants.FIREBASE.MEDIA_PATH_PREFIX,  // lynnWhatsappChat
        cleanWhatsappId,                       // whatsappId
        year.toString(),                       // YYYY
        month,                                 // MM
        senderType,                           // user/ai/lm
        generatedFilename                     // messageType_messageId_timestamp.ext
      ];
      
      return pathComponents.join('/');
      
    } catch (error) {
      throw new Error(`Path generation failed: ${error.message}`);
    }
  }
  
  /**
   * Get sender type from message direction
   * @param {string} direction - Message direction
   * @returns {string} - Sender type
   */
  static getSenderType(direction) {
    const typeMap = {
      'inbound': constants.SENDER_TYPES.USER,
      'outbound_ai': constants.SENDER_TYPES.AI,
      'outbound_lm': constants.SENDER_TYPES.LM
    };
    
    return typeMap[direction] || constants.SENDER_TYPES.USER;
  }
  
  /**
   * Extract file extension from filename
   * @param {string} filename - Original filename
   * @returns {string} - File extension (without dot)
   */
  static getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Invalid filename provided');
    }
    
    const ext = path.extname(filename).slice(1).toLowerCase();
    if (!ext) {
      throw new Error('File must have a valid extension');
    }
    
    return ext;
  }
  
  /**
   * Sanitize path component to prevent directory traversal and injection
   * @param {string} component - Path component to sanitize
   * @returns {string} - Sanitized component
   */
  static sanitizePathComponent(component) {
    if (!component || typeof component !== 'string') {
      throw new Error('Invalid path component');
    }
    
    // Remove potentially dangerous characters and sequences
    return component
      .replace(/[^a-zA-Z0-9._-]/g, '')  // Only allow alphanumeric, dots, underscores, hyphens
      .replace(/\.+/g, '.')             // Replace multiple dots with single dot
      .replace(/^\.+|\.+$/g, '');       // Remove leading/trailing dots
  }
  
  /**
   * Parse storage path to extract components
   * @param {string} storagePath - Full storage path
   * @returns {Object} - Parsed path components
   */
  static parseStoragePath(storagePath) {
    try {
      if (!storagePath || typeof storagePath !== 'string') {
        throw new Error('Invalid storage path');
      }
      
      const pathParts = storagePath.split('/');
      
      if (pathParts.length < 6) {
        throw new Error('Invalid path format');
      }
      
      const filename = pathParts[pathParts.length - 1];
      const filenameParts = filename.split('_');
      
      return {
        prefix: pathParts[0],
        whatsappId: pathParts[1],
        year: pathParts[2],
        month: pathParts[3],
        senderType: pathParts[4],
        filename: filename,
        messageType: filenameParts[0] || null,
        messageId: filenameParts[1] || null,
        timestamp: filenameParts[2] ? filenameParts[2].split('.')[0] : null,
        extension: path.extname(filename).slice(1)
      };
      
    } catch (error) {
      throw new Error(`Path parsing failed: ${error.message}`);
    }
  }
  
  /**
   * Generate path for specific date range (useful for queries)
   * @param {string} whatsappId - WhatsApp ID
   * @param {number} startDate - Start date timestamp
   * @param {number} endDate - End date timestamp
   * @param {string} senderType - Sender type (optional)
   * @returns {Array} - Array of path prefixes for the date range
   */
  static generateDateRangePaths(whatsappId, startDate, endDate, senderType = null) {
    const paths = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Generate monthly path prefixes
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    
    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      
      const basePath = [
        constants.FIREBASE.MEDIA_PATH_PREFIX,
        this.sanitizePathComponent(whatsappId),
        year.toString(),
        month
      ];
      
      if (senderType) {
        basePath.push(senderType);
      }
      
      paths.push(basePath.join('/'));
      
      // Move to next month
      current.setMonth(current.getMonth() + 1);
    }
    
    return paths;
  }
}

module.exports = PathGenerator;