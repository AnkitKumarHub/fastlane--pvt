/**
 * Media Processor
 * Single file containing all media processing functions
 * Handles image, video, audio, document, sticker, location, and contact processing
 */

const path = require('path');
const MediaValidator = require('./media/MediaValidator');
const MediaUtils = require('./media/MediaUtils');
const PathGenerator = require('./media/PathGenerator');
const constants = require('../utils/constants');
const logger = require('../utils/logger');

class MediaProcessor {
  
  /**
   * Main entry point for media processing
   * @param {Object} messageData - Message data containing from, messageId, etc.
   * @param {Object} mediaInfo - Media information (buffer, mimeType, filename)
   * @param {string} direction - Message direction (inbound, outbound_ai, outbound_lm)
   * @returns {Object} - Processing result with storagePath and metadata
   */
  static async processMedia(messageData, mediaInfo, direction) {
    try {
      logger.debug('MediaProcessor', 'Starting media processing', {
        messageId: messageData.messageId,
        direction,
        mimeType: mediaInfo.mimeType,
        fileSize: mediaInfo.buffer?.length
      });
      
      // Validate media
      const validation = MediaValidator.validateMedia(mediaInfo);
      if (!validation.isValid) {
        throw new Error(`Media validation failed: ${validation.error}`);
      }
      
      const mediaType = validation.mediaType;
      
      // Route to appropriate processor
      let result;
      switch (mediaType) {
        case constants.MEDIA_TYPES.IMAGE:
          result = await this.processImage(messageData, mediaInfo, direction);
          break;
        case constants.MEDIA_TYPES.VIDEO:
          result = await this.processVideo(messageData, mediaInfo, direction);
          break;
        case constants.MEDIA_TYPES.AUDIO:
          result = await this.processAudio(messageData, mediaInfo, direction);
          break;
        case constants.MEDIA_TYPES.VOICE:
          result = await this.processVoice(messageData, mediaInfo, direction);
          break;
        case constants.MEDIA_TYPES.DOCUMENT:
          result = await this.processDocument(messageData, mediaInfo, direction);
          break;
        case constants.MEDIA_TYPES.STICKER:
          result = await this.processSticker(messageData, mediaInfo, direction);
          break;
        case constants.MEDIA_TYPES.LOCATION:
          result = await this.processLocation(messageData, mediaInfo, direction);
          break;
        case constants.MEDIA_TYPES.CONTACT:
          result = await this.processContact(messageData, mediaInfo, direction);
          break;
        default:
          throw new Error(`Unsupported media type: ${mediaType}`);
      }
      
      // Add validation warnings to result
      if (validation.warnings && validation.warnings.length > 0) {
        result.warnings = validation.warnings;
      }
      
      logger.success('MediaProcessor', 'Media processing completed', {
        messageId: messageData.messageId,
        mediaType,
        storagePath: result.storagePath,
        fileSize: result.fileSize
      });
      
      return result;
      
    } catch (error) {
      logger.error('MediaProcessor', `Media processing failed: ${error.message}`, {
        messageId: messageData?.messageId,
        direction,
        mimeType: mediaInfo?.mimeType,
        error: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Process image files
   * @param {Object} messageData - Message data
   * @param {Object} mediaInfo - Media information
   * @param {string} direction - Message direction
   * @returns {Object} - Processing result
   */
  static async processImage(messageData, mediaInfo, direction) {
    logger.debug('MediaProcessor', 'Processing image', {
      messageId: messageData.messageId,
      mimeType: mediaInfo.mimeType
    });
    
    // Generate storage path
    const storagePath = PathGenerator.generateMediaPath(
      messageData.from || messageData.to,
      messageData.messageId,
      Date.now(),
      direction,
      constants.MEDIA_TYPES.IMAGE,
      mediaInfo.filename
    );
    
    // Upload to storage
    const uploadResult = await this.uploadToStorage(mediaInfo.buffer, storagePath, mediaInfo);
    
    return {
      type: constants.MEDIA_TYPES.IMAGE,
      storagePath,
      url: uploadResult.url,
      mimeType: mediaInfo.mimeType,
      fileName: path.basename(storagePath), // ✅ Use storage path filename for consistency
      fileSize: mediaInfo.buffer.length,
      metadata: {
        originalFileName: mediaInfo.filename // ✅ Keep WhatsApp original for reference
        // ❌ Removed dimensions and hasAlpha as requested
      }
    };
  }
  
  /**
   * Process video files (MP4, 3GP only)
   * @param {Object} messageData - Message data
   * @param {Object} mediaInfo - Media information
   * @param {string} direction - Message direction
   * @returns {Object} - Processing result
   */
  static async processVideo(messageData, mediaInfo, direction) {
    logger.debug('MediaProcessor', 'Processing video', {
      messageId: messageData.messageId,
      mimeType: mediaInfo.mimeType,
      fileSize: mediaInfo.buffer.length
    });
    
    // Validate video format is WhatsApp compatible
    if (!['video/mp4', 'video/3gpp'].includes(mediaInfo.mimeType.toLowerCase())) {
      throw new Error(`Video format ${mediaInfo.mimeType} not supported by WhatsApp`);
    }
    
    // Generate storage path
    const storagePath = PathGenerator.generateMediaPath(
      messageData.from || messageData.to,
      messageData.messageId,
      Date.now(),
      direction,
      constants.MEDIA_TYPES.VIDEO,
      mediaInfo.filename
    );
    
    // Upload to storage
    const uploadResult = await this.uploadToStorage(mediaInfo.buffer, storagePath, mediaInfo);
    
    return {
      type: constants.MEDIA_TYPES.VIDEO,
      storagePath,
      url: uploadResult.url,
      mimeType: mediaInfo.mimeType,
      fileName: path.basename(storagePath), // ✅ Use storage path filename for consistency
      fileSize: mediaInfo.buffer.length,
      metadata: {
        duration: mediaInfo.duration || null,
        codec: mediaInfo.mimeType === 'video/mp4' ? 'h264' : '3gpp',
        originalFileName: mediaInfo.filename // ✅ Keep WhatsApp original for reference
        // ❌ Removed dimensions as requested
      }
    };
  }
  
  /**
   * Process audio files
   * @param {Object} messageData - Message data
   * @param {Object} mediaInfo - Media information
   * @param {string} direction - Message direction
   * @returns {Object} - Processing result
   */
  static async processAudio(messageData, mediaInfo, direction) {
    logger.debug('MediaProcessor', 'Processing audio', {
      messageId: messageData.messageId,
      mimeType: mediaInfo.mimeType
    });
    
    // Generate storage path
    const storagePath = PathGenerator.generateMediaPath(
      messageData.from || messageData.to,
      messageData.messageId,
      Date.now(),
      direction,
      constants.MEDIA_TYPES.AUDIO,
      mediaInfo.filename
    );
    
    // Upload to storage
    const uploadResult = await this.uploadToStorage(mediaInfo.buffer, storagePath, mediaInfo);
    
    return {
      type: constants.MEDIA_TYPES.AUDIO,
      storagePath,
      url: uploadResult.url,
      mimeType: mediaInfo.mimeType,
      fileName: path.basename(storagePath),
      fileSize: mediaInfo.buffer.length,
      metadata: {
        originalFileName: mediaInfo.filename
      }
    };
  }
  
  /**
   * Process voice messages (WhatsApp voice notes)
   * @param {Object} messageData - Message data
   * @param {Object} mediaInfo - Media information
   * @param {string} direction - Message direction
   * @returns {Object} - Processing result
   */
  static async processVoice(messageData, mediaInfo, direction) {
    logger.debug('MediaProcessor', 'Processing voice message', {
      messageId: messageData.messageId,
      mimeType: mediaInfo.mimeType
    });
    
    // Generate storage path
    const storagePath = PathGenerator.generateMediaPath(
      messageData.from || messageData.to,
      messageData.messageId,
      Date.now(),
      direction,
      constants.MEDIA_TYPES.VOICE,
      mediaInfo.filename
    );
    
    // Upload to storage
    const uploadResult = await this.uploadToStorage(mediaInfo.buffer, storagePath, mediaInfo);
    
    return {
      type: constants.MEDIA_TYPES.VOICE,
      storagePath,
      url: uploadResult.url,
      mimeType: mediaInfo.mimeType,
      fileName: path.basename(storagePath),
      fileSize: mediaInfo.buffer.length,
      metadata: {
        originalFileName: mediaInfo.filename
      }
    };
  }
  
  /**
   * Process document files
   * @param {Object} messageData - Message data
   * @param {Object} mediaInfo - Media information
   * @param {string} direction - Message direction
   * @returns {Object} - Processing result
   */
  static async processDocument(messageData, mediaInfo, direction) {
    logger.debug('MediaProcessor', 'Processing document', {
      messageId: messageData.messageId,
      mimeType: mediaInfo.mimeType,
      fileName: mediaInfo.filename
    });
    
    // Generate storage path
    const storagePath = PathGenerator.generateMediaPath(
      messageData.from || messageData.to,
      messageData.messageId,
      Date.now(),
      direction,
      constants.MEDIA_TYPES.DOCUMENT,
      mediaInfo.filename
    );
    
    // Upload to storage
    const uploadResult = await this.uploadToStorage(mediaInfo.buffer, storagePath, mediaInfo);
    
    // Extract document-specific metadata
    const documentType = this.getDocumentType(mediaInfo.mimeType);
    const pageCount = await this.extractPageCount(mediaInfo.buffer, mediaInfo.mimeType);
    
    return {
      type: constants.MEDIA_TYPES.DOCUMENT,
      storagePath,
      url: uploadResult.url,
      mimeType: mediaInfo.mimeType,
      fileName: path.basename(storagePath),
      fileSize: mediaInfo.buffer.length,
      metadata: {
        originalFileName: mediaInfo.filename,
        documentType,
        pageCount,
        isTextSearchable: this.isTextSearchable(mediaInfo.mimeType)
      }
    };
  }
  
  /**
   * Process sticker files (WebP only)
   * @param {Object} messageData - Message data
   * @param {Object} mediaInfo - Media information
   * @param {string} direction - Message direction
   * @returns {Object} - Processing result
   */
  static async processSticker(messageData, mediaInfo, direction) {
    logger.debug('MediaProcessor', 'Processing sticker', {
      messageId: messageData.messageId,
      mimeType: mediaInfo.mimeType
    });
    
    // Validate sticker format
    if (mediaInfo.mimeType.toLowerCase() !== 'image/webp') {
      throw new Error('Stickers must be in WebP format');
    }
    
    // Generate storage path
    const storagePath = PathGenerator.generateMediaPath(
      messageData.from || messageData.to,
      messageData.messageId,
      Date.now(),
      direction,
      constants.MEDIA_TYPES.STICKER,
      mediaInfo.filename
    );
    
    // Upload to storage
    const uploadResult = await this.uploadToStorage(mediaInfo.buffer, storagePath, mediaInfo);
    
    return {
      type: constants.MEDIA_TYPES.STICKER,
      storagePath,
      url: uploadResult.url,
      mimeType: mediaInfo.mimeType,
      fileName: path.basename(storagePath),
      fileSize: mediaInfo.buffer.length,
      metadata: {
        originalFileName: mediaInfo.filename,
        isAnimated: this.isAnimatedWebP(mediaInfo.buffer)
      }
    };
  }
  
  /**
   * Process location data
   * @param {Object} messageData - Message data containing location info
   * @param {Object} locationInfo - Location information
   * @param {string} direction - Message direction
   * @returns {Object} - Processing result
   */
  static async processLocation(messageData, locationInfo, direction) {
    logger.debug('MediaProcessor', 'Processing location', {
      messageId: messageData.messageId,
      hasCoordinates: !!(locationInfo.latitude && locationInfo.longitude)
    });
    
    // Validate location data
    if (!locationInfo.latitude || !locationInfo.longitude) {
      throw new Error('Location must include latitude and longitude');
    }
    
    // Validate coordinates
    if (Math.abs(locationInfo.latitude) > 90 || Math.abs(locationInfo.longitude) > 180) {
      throw new Error('Invalid latitude or longitude values');
    }
    
    return {
      type: constants.MEDIA_TYPES.LOCATION,
      storagePath: null, // Location data doesn't need file storage
      url: null,
      mimeType: null,
      fileName: null,
      fileSize: 0,
      metadata: {
        latitude: parseFloat(locationInfo.latitude),
        longitude: parseFloat(locationInfo.longitude),
        name: locationInfo.name || null,
        address: locationInfo.address || null,
        url: locationInfo.url || null
      }
    };
  }
  
  /**
   * Process contact data (vCard)
   * @param {Object} messageData - Message data containing contact info
   * @param {Object} contactInfo - Contact information
   * @param {string} direction - Message direction
   * @returns {Object} - Processing result
   */
  static async processContact(messageData, contactInfo, direction) {
    logger.debug('MediaProcessor', 'Processing contact', {
      messageId: messageData.messageId,
      hasVCard: !!contactInfo.vcard
    });
    
    // Parse vCard if provided
    let parsedContact = null;
    if (contactInfo.vcard) {
      parsedContact = this.parseVCard(contactInfo.vcard);
    }
    
    return {
      type: constants.MEDIA_TYPES.CONTACT,
      storagePath: null, // Contact data doesn't need file storage
      url: null,
      mimeType: 'text/vcard',
      fileName: null,
      fileSize: contactInfo.vcard ? Buffer.byteLength(contactInfo.vcard, 'utf8') : 0,
      metadata: {
        name: contactInfo.name || parsedContact?.name || 'Unknown Contact',
        phoneNumbers: parsedContact?.phoneNumbers || [],
        emails: parsedContact?.emails || [],
        organization: parsedContact?.organization || null,
        vcard: contactInfo.vcard || null
      }
    };
  }
  
  /**
   * Upload file to Firebase Storage using MediaService
   * @param {Buffer} buffer - File buffer
   * @param {string} storagePath - Storage path
   * @param {Object} mediaInfo - Media information
   * @returns {Object} - Upload result
   */
  static async uploadToStorage(buffer, storagePath, mediaInfo) {
    // Import mediaService here to avoid circular dependency
    const mediaService = require('./mediaService');
    
    try {
      logger.debug('MediaProcessor', 'Uploading to storage using MediaService', {
        storagePath,
        fileSize: buffer.length,
        mimeType: mediaInfo.mimeType
      });

      // Use MediaService.uploadWithPath for consistent upload behavior
      const uploadResult = await mediaService.uploadWithPath(buffer, storagePath, mediaInfo);
      
      logger.info('MediaProcessor', 'Upload successful', {
        storagePath,
        url: uploadResult.url
      });
      
      return uploadResult;
      
    } catch (error) {
      logger.error('MediaProcessor', `Upload failed: ${error.message}`, error);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }
  
  /**
   * Get document type from MIME type
   * @param {string} mimeType - MIME type
   * @returns {string} - Document type
   */
  static getDocumentType(mimeType) {
    const typeMap = {
      'application/pdf': 'PDF',
      'application/msword': 'Word Document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
      'application/vnd.ms-excel': 'Excel Spreadsheet',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
      'application/vnd.ms-powerpoint': 'PowerPoint Presentation',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint Presentation',
      'text/plain': 'Text File'
    };
    
    return typeMap[mimeType.toLowerCase()] || 'Unknown Document';
  }
  
  /**
   * Extract page count from document (simplified)
   * @param {Buffer} buffer - Document buffer
   * @param {string} mimeType - MIME type
   * @returns {number|null} - Page count or null if cannot determine
   */
  static async extractPageCount(buffer, mimeType) {
    try {
      if (mimeType === 'application/pdf') {
        // Simple PDF page count extraction
        const pdfText = buffer.toString('latin1');
        const pageMatches = pdfText.match(/\/Count\s+(\d+)/);
        if (pageMatches) {
          return parseInt(pageMatches[1]);
        }
      }
      return null;
    } catch (error) {
      logger.warn('MediaProcessor', 'Could not extract page count', { mimeType });
      return null;
    }
  }
  
  /**
   * Check if document type is text searchable
   * @param {string} mimeType - MIME type
   * @returns {boolean} - Whether document is text searchable
   */
  static isTextSearchable(mimeType) {
    const searchableTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    return searchableTypes.includes(mimeType.toLowerCase());
  }
  
  /**
   * Check if WebP is animated
   * @param {Buffer} buffer - WebP buffer
   * @returns {boolean} - Whether WebP is animated
   */
  static isAnimatedWebP(buffer) {
    try {
      // Look for ANMF chunk in WebP
      const webpString = buffer.toString('latin1');
      return webpString.includes('ANMF');
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Parse vCard contact information
   * @param {string} vcard - vCard string
   * @returns {Object} - Parsed contact information
   */
  static parseVCard(vcard) {
    try {
      const lines = vcard.split('\n');
      const contact = {
        name: null,
        phoneNumbers: [],
        emails: [],
        organization: null
      };
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('FN:')) {
          contact.name = trimmed.substring(3);
        } else if (trimmed.startsWith('TEL:') || trimmed.includes('TEL;')) {
          const phoneMatch = trimmed.match(/TEL[^:]*:(.+)/);
          if (phoneMatch) {
            contact.phoneNumbers.push(phoneMatch[1]);
          }
        } else if (trimmed.startsWith('EMAIL:') || trimmed.includes('EMAIL;')) {
          const emailMatch = trimmed.match(/EMAIL[^:]*:(.+)/);
          if (emailMatch) {
            contact.emails.push(emailMatch[1]);
          }
        } else if (trimmed.startsWith('ORG:')) {
          contact.organization = trimmed.substring(4);
        }
      }
      
      return contact;
    } catch (error) {
      logger.warn('MediaProcessor', 'vCard parsing failed', { error: error.message });
      return { name: null, phoneNumbers: [], emails: [], organization: null };
    }
  }
}

module.exports = MediaProcessor;