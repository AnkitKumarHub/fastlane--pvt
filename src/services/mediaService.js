/**
 * Media Service
 * Handles Firebase Storage operations for WhatsApp media files
 * Enhanced with structured storage paths and new media processing
 */

const firebaseConfig = require('../utils/firebaseConfig');
const logger = require('../utils/logger');
const validator = require('../utils/validators');
const constants = require('../utils/constants');
const MediaProcessor = require('./mediaProcessor');
const path = require('path');

class MediaService {
  constructor() {
    this.bucket = null;
    this.storage = null;
  }

  /**
   * Initialize Firebase Storage
   */
  initialize() {
    try {
      if (!firebaseConfig.isFirebaseReady()) {
        firebaseConfig.initialize();
      }
      
      this.bucket = firebaseConfig.getBucket();
      this.storage = firebaseConfig.getStorage();
      
      logger.success('MediaService', 'Firebase Storage initialized');
    } catch (error) {
      logger.error('MediaService', `Failed to initialize Firebase Storage: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Enhanced upload media file using new MediaProcessor and structured paths
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} whatsappId - WhatsApp ID
   * @param {string} messageId - Message ID
   * @param {string} originalFileName - Original filename
   * @param {string} mimeType - MIME type
   * @param {string} direction - Message direction (inbound, outbound_ai, outbound_lm)
   * @returns {Object} - Upload result with storagePath
   */
  async uploadMediaFile(fileBuffer, whatsappId, messageId, originalFileName, mimeType, direction = 'inbound') {
    try {
      if (!this.bucket) {
        this.initialize();
      }

      // Validate inputs
      validator.validateWhatsappId(whatsappId);
      validator.validateMessageId(messageId);

      if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
        throw new Error('File buffer is required and must be a valid Buffer');
      }

      if (!originalFileName || typeof originalFileName !== 'string') {
        throw new Error('Original filename is required');
      }

      if (!mimeType || typeof mimeType !== 'string') {
        throw new Error('MIME type is required');
      }

      // Prepare media info for new processor
      const mediaInfo = {
        buffer: fileBuffer,
        mimeType: mimeType,
        filename: originalFileName,
        fileSize: fileBuffer.length
      };

      // Prepare message data
      const messageData = {
        from: direction === 'inbound' ? whatsappId : null,
        to: direction !== 'inbound' ? whatsappId : null,
        messageId: messageId
      };

      logger.media('UPLOAD_START', originalFileName, fileBuffer.length, {
        whatsappId,
        messageId,
        mimeType,
        direction
      });

      // Use new MediaProcessor for enhanced processing
      const result = await MediaProcessor.processMedia(messageData, mediaInfo, direction);

      logger.media('UPLOAD_SUCCESS', originalFileName, fileBuffer.length, {
        whatsappId,
        messageId,
        storagePath: result.storagePath,
        publicUrl: result.url
      });

      return {
        url: result.url,
        storagePath: result.storagePath,  // NEW: Include storage path
        type: result.type,
        mimeType: result.mimeType,
        fileName: result.fileName,
        fileSize: result.fileSize,
        metadata: result.metadata,
        warnings: result.warnings,
        uploadedAt: new Date()
      };

    } catch (error) {
      logger.error('MediaService', `Failed to upload media file: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * NEW: Upload with custom storage path (used by MediaProcessor)
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} storagePath - Custom storage path
   * @param {Object} mediaInfo - Media information
   * @returns {Object} - Upload result
   */
  async uploadWithPath(fileBuffer, storagePath, mediaInfo) {
    try {
      if (!this.bucket) {
        this.initialize();
      }

      if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
        throw new Error('File buffer is required and must be a valid Buffer');
      }

      if (!storagePath || typeof storagePath !== 'string') {
        throw new Error('Storage path is required');
      }

      if (!mediaInfo || !mediaInfo.mimeType) {
        throw new Error('Media info with MIME type is required');
      }

      logger.debug('MediaService', 'Uploading with custom path', {
        storagePath,
        fileSize: fileBuffer.length,
        mimeType: mediaInfo.mimeType
      });

      // Upload file to Firebase Storage
      const file = this.bucket.file(storagePath);
      
      const uploadOptions = {
        metadata: {
          contentType: mediaInfo.mimeType,
          metadata: {
            originalFileName: mediaInfo.filename || 'unknown',
            uploadedAt: new Date().toISOString(),
            fileSize: fileBuffer.length.toString(),
            processedBy: 'MediaProcessor'
          }
        },
        public: true,
        validation: 'crc32c'
      };

      // Upload the file
      await file.save(fileBuffer, uploadOptions);

      // Generate public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${storagePath}`;

      logger.success('MediaService', 'File uploaded with custom path', {
        storagePath,
        publicUrl,
        fileSize: fileBuffer.length
      });

      return {
        url: publicUrl,
        storagePath,
        success: true
      };

    } catch (error) {
      logger.error('MediaService', `Failed to upload with custom path: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Download media file from Firebase Storage
   */
  async downloadMediaFile(storagePath) {
    try {
      if (!this.bucket) {
        this.initialize();
      }

      if (!storagePath || typeof storagePath !== 'string') {
        throw new Error('Storage path is required');
      }

      logger.media('DOWNLOAD_START', storagePath);

      const file = this.bucket.file(storagePath);
      
      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File not found at path: ${storagePath}`);
      }

      // Get file metadata
      const [metadata] = await file.getMetadata();
      
      // Download file content
      const [fileBuffer] = await file.download();

      logger.media('DOWNLOAD_SUCCESS', storagePath, fileBuffer.length, {
        contentType: metadata.contentType,
        size: metadata.size
      });

      return {
        buffer: fileBuffer,
        metadata: {
          contentType: metadata.contentType,
          size: parseInt(metadata.size),
          created: metadata.timeCreated,
          updated: metadata.updated
        }
      };

    } catch (error) {
      logger.error('MediaService', `Failed to download media file: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get media file URL (for existing files)
   */
  async getMediaUrl(storagePath) {
    try {
      if (!this.bucket) {
        this.initialize();
      }

      if (!storagePath || typeof storagePath !== 'string') {
        throw new Error('Storage path is required');
      }

      const file = this.bucket.file(storagePath);
      
      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File not found at path: ${storagePath}`);
      }

      // Generate public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${storagePath}`;

      logger.debug('MediaService', `Media URL generated`, { storagePath, publicUrl });

      return publicUrl;

    } catch (error) {
      logger.error('MediaService', `Failed to get media URL: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Delete media file from Firebase Storage
   */
  async deleteMediaFile(storagePath) {
    try {
      if (!this.bucket) {
        this.initialize();
      }

      if (!storagePath || typeof storagePath !== 'string') {
        throw new Error('Storage path is required');
      }

      logger.media('DELETE_START', storagePath);

      const file = this.bucket.file(storagePath);
      
      // Check if file exists before deleting
      const [exists] = await file.exists();
      if (!exists) {
        logger.warn('MediaService', `File not found for deletion`, { storagePath });
        return false;
      }

      // Delete the file
      await file.delete();

      logger.media('DELETE_SUCCESS', storagePath);

      return true;

    } catch (error) {
      logger.error('MediaService', `Failed to delete media file: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(storagePath) {
    try {
      if (!this.bucket) {
        this.initialize();
      }

      const file = this.bucket.file(storagePath);
      
      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [metadata] = await file.getMetadata();

      return {
        name: metadata.name,
        size: parseInt(metadata.size),
        contentType: metadata.contentType,
        created: metadata.timeCreated,
        updated: metadata.updated,
        md5Hash: metadata.md5Hash,
        crc32c: metadata.crc32c,
        customMetadata: metadata.metadata || {}
      };

    } catch (error) {
      logger.error('MediaService', `Failed to get file metadata: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * List media files for a specific user
   */
  async listUserMediaFiles(whatsappId, limit = 50) {
    try {
      if (!this.bucket) {
        this.initialize();
      }

      validator.validateWhatsappId(whatsappId);

      const prefix = `${constants.FIREBASE.MEDIA_PATH_PREFIX}/${whatsappId}/`;
      
      logger.debug('MediaService', `Listing media files for user`, { whatsappId, prefix });

      const [files] = await this.bucket.getFiles({
        prefix,
        maxResults: limit
      });

      const fileList = await Promise.all(
        files.map(async (file) => {
          try {
            const [metadata] = await file.getMetadata();
            return {
              name: metadata.name,
              size: parseInt(metadata.size),
              contentType: metadata.contentType,
              created: metadata.timeCreated,
              updated: metadata.updated,
              publicUrl: `https://storage.googleapis.com/${this.bucket.name}/${metadata.name}`
            };
          } catch (error) {
            logger.warn('MediaService', `Failed to get metadata for file: ${file.name}`, error);
            return null;
          }
        })
      );

      // Filter out null results
      const validFiles = fileList.filter(file => file !== null);

      logger.success('MediaService', `Media files listed for user`, {
        whatsappId,
        filesFound: validFiles.length
      });

      return validFiles;

    } catch (error) {
      logger.error('MediaService', `Failed to list user media files: ${error.message}`, error);
      throw error;
    }
  }



  /**
   * Determine media type from MIME type
   */
  getMediaTypeFromMimeType(mimeType) {
    if (mimeType.startsWith('image/')) {
      return constants.MEDIA_TYPES.IMAGE;
    } else if (mimeType.startsWith('video/')) {
      return constants.MEDIA_TYPES.VIDEO;
    } else if (mimeType.startsWith('audio/')) {
      return constants.MEDIA_TYPES.AUDIO;
    } else if (mimeType.startsWith('application/') || mimeType.startsWith('text/')) {
      return constants.MEDIA_TYPES.DOCUMENT;
    } else {
      throw new Error(`Unsupported MIME type: ${mimeType}`);
    }
  }
}

// Create singleton instance
const mediaService = new MediaService();

module.exports = mediaService;