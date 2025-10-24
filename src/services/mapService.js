/**
 * Map Service
 * Handles static map thumbnail generation using Google Static Maps API
 * Uploads thumbnails to Firebase Storage using existing MediaService
 */

const axios = require('axios');
const logger = require('../utils/logger');
const mediaService = require('./mediaService');

class MapService {
  
  /**
   * Generate and upload map thumbnail for coordinates
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @param {string} messageId - Message ID for unique filename
   * @returns {Object} - Upload result with URL
   */
  static async generateMapThumbnail(latitude, longitude, messageId) {
    try {
      // Check if thumbnail generation is enabled
      if (process.env.ENABLE_LOCATION_THUMBNAILS !== 'true') {
        logger.info('MapService', 'Map thumbnails disabled, returning null');
        return { url: null };
      }

      // Check if API key is available
      if (!process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key_here') {
        logger.warn('MapService', 'Google Maps API key not configured');
        return { url: null };
      }

      logger.debug('MapService', 'Generating map thumbnail', {
        latitude,
        longitude,
        messageId
      });

      // Generate static map URL
      const mapUrl = this.buildStaticMapUrl(latitude, longitude);
      
      // Download map image using axios
      const response = await axios.get(mapUrl, {
        responseType: 'arraybuffer'
      });
      
      const buffer = Buffer.from(response.data);

      // Generate storage path for thumbnail with proper filename pattern
      const timestamp = Date.now();
      const shortId = messageId.slice(-8); // Last 8 characters of message ID
      const fileName = `map_thumbnail_${shortId}_${timestamp}.png`;
      const thumbnailPath = `lynnWhatsappChat/map_thumbnails/${fileName}`;

      // Upload to Firebase Storage using existing MediaService
      const uploadResult = await this.uploadThumbnailToStorage(buffer, thumbnailPath, fileName);

      logger.info('MapService', 'Map thumbnail generated successfully', {
        thumbnailUrl: uploadResult.url,
        messageId
      });

      return uploadResult;

    } catch (error) {
      logger.error('MapService', 'Map thumbnail generation failed', {
        error: error.message,
        status: error.response?.status,
        latitude,
        longitude,
        messageId
      });
      
      // Return null URL on error to allow location processing to continue
      return { url: null };
    }
  }

  /**
   * Build Google Static Maps API URL
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {string} - Static map URL
   */
  static buildStaticMapUrl(latitude, longitude) {
    const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
    const params = new URLSearchParams({
      center: `${latitude},${longitude}`,
      zoom: '15',
      size: '400x300',
      maptype: 'roadmap',
      markers: `color:red|${latitude},${longitude}`,
      key: process.env.GOOGLE_MAPS_API_KEY
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Upload thumbnail to Firebase Storage using existing MediaService
   * @param {Buffer} buffer - Image buffer
   * @param {string} storagePath - Storage path
   * @param {string} fileName - File name for metadata
   * @returns {Object} - Upload result with URL and file info
   */
  static async uploadThumbnailToStorage(buffer, storagePath, fileName) {
    try {
      logger.debug('MapService', 'Uploading thumbnail using MediaService', {
        storagePath,
        fileName,
        bufferSize: buffer.length
      });

      // Use existing MediaService.uploadWithPath method
      const uploadResult = await mediaService.uploadWithPath(buffer, storagePath, {
        mimeType: 'image/png',
        filename: fileName
      });

      logger.info('MapService', 'Thumbnail uploaded successfully using MediaService', {
        storagePath,
        fileName,
        downloadURL: uploadResult.url
      });

      return {
        url: uploadResult.url,
        storagePath: uploadResult.storagePath,
        fileName: fileName,
        mimeType: 'image/png',
        fileSize: buffer.length
      };

    } catch (error) {
      logger.error('MapService', 'Thumbnail upload failed', {
        error: error.message,
        code: error.code,
        storagePath,
        fileName,
        bufferSize: buffer.length
      });
      throw error;
    }
  }

  /**
   * Validate map generation parameters
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @param {string} messageId - Message ID
   * @returns {boolean} - True if parameters are valid
   */
  static validateParameters(latitude, longitude, messageId) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    return (
      !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      messageId && typeof messageId === 'string'
    );
  }
}

module.exports = MapService;