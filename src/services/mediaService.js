/**
 * Media Service
 * Handles Firebase Storage operations for WhatsApp media files
 */

const firebaseConfig = require('../utils/firebaseConfig');
const logger = require('../utils/logger');
const validator = require('../utils/validators');
const constants = require('../utils/constants');
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
   * Upload media file to Firebase Storage
   */
  async uploadMediaFile(fileBuffer, whatsappId, messageId, originalFileName, mimeType) {
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

      // Validate file size
      if (fileBuffer.length > constants.FIREBASE.MAX_FILE_SIZE) {
        throw new Error(`File size exceeds maximum allowed size of ${constants.FIREBASE.MAX_FILE_SIZE} bytes`);
      }

      // Validate MIME type
      if (!constants.FIREBASE.ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new Error(`MIME type ${mimeType} is not allowed`);
      }

      // Get file extension
      const fileExtension = path.extname(originalFileName).slice(1).toLowerCase();
      if (!fileExtension) {
        throw new Error('File must have a valid extension');
      }

      // Determine media type from MIME type
      const mediaType = this.getMediaTypeFromMimeType(mimeType);
      validator.validateFileExtension(fileExtension, mediaType);
      validator.validateFileSize(fileBuffer.length, mediaType);

      // Generate storage path
      const storagePath = firebaseConfig.generateMediaPath(whatsappId, messageId, fileExtension);

      logger.media('UPLOAD_START', originalFileName, fileBuffer.length, {
        whatsappId,
        messageId,
        storagePath,
        mimeType
      });

      // Upload file to Firebase Storage
      const file = this.bucket.file(storagePath);
      
      const uploadOptions = {
        metadata: {
          contentType: mimeType,
          metadata: {
            whatsappId,
            messageId,
            originalFileName,
            uploadedAt: new Date().toISOString()
          }
        },
        public: true, // Make file publicly readable
        validation: 'crc32c'
      };

      // Upload the file
      await file.save(fileBuffer, uploadOptions);

      // Generate public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${storagePath}`;

      logger.media('UPLOAD_SUCCESS', originalFileName, fileBuffer.length, {
        whatsappId,
        messageId,
        publicUrl,
        storagePath
      });

      return {
        url: publicUrl,
        storagePath,
        type: mediaType,
        mimeType,
        fileName: originalFileName,
        fileSize: fileBuffer.length,
        uploadedAt: new Date()
      };

    } catch (error) {
      logger.error('MediaService', `Failed to upload media file: ${error.message}`, error);
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