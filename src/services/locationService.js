/**
 * Location Service
 * Handles location message processing without media validation
 * Coordinates reverse geocoding and map thumbnail generation
 */

const logger = require('../utils/logger');
const GeocodingService = require('./geocodingService');
const MapService = require('./mapService');

class LocationService {
  
  /**
   * Process location data without media validation
   * @param {Object} messageData - Message data containing from, messageId, etc.
   * @param {Object} locationData - Location information with coordinates
   * @param {string} direction - Message direction
   * @returns {Object} - Processing result with location metadata
   */
  static async processLocation(messageData, locationData, direction) {
    try {
      logger.debug('LocationService', 'Processing location message', {
        messageId: messageData.messageId,
        coordinates: {
          latitude: locationData.latitude,
          longitude: locationData.longitude
        },
        direction
      });

      // Validate coordinates
      if (!this.validateCoordinates(locationData.latitude, locationData.longitude)) {
        throw new Error('Invalid latitude or longitude values');
      }

      const latitude = parseFloat(locationData.latitude);
      const longitude = parseFloat(locationData.longitude);

      // Perform reverse geocoding to get address information
      const addressInfo = await GeocodingService.reverseGeocode(latitude, longitude);

      // Generate map thumbnail
      const thumbnailResult = await MapService.generateMapThumbnail(
        latitude, 
        longitude, 
        messageData.messageId
      );

      // Build location result object
      const locationResult = {
        type: 'location',
        metadata: {
          latitude,
          longitude,
          name: addressInfo.name,
          address: addressInfo.address
        }
      };

      // Add thumbnail information if generated successfully
      if (thumbnailResult.url) {
        locationResult.thumbnailUrl = thumbnailResult.url;
        locationResult.thumbnailPath = thumbnailResult.storagePath;
        // Add file information for database validation
        locationResult.fileName = thumbnailResult.fileName;
        locationResult.mimeType = thumbnailResult.mimeType;
        locationResult.fileSize = thumbnailResult.fileSize;
      } else {
        // Provide default values when thumbnail generation fails
        locationResult.fileName = null;
        locationResult.mimeType = null;
        locationResult.fileSize = 0;
      }

      logger.info('LocationService', 'Location processing completed', {
        messageId: messageData.messageId,
        hasAddress: !!addressInfo.address,
        hasThumbnail: !!thumbnailResult.url,
        coordinates: { latitude, longitude }
      });

      return locationResult;

    } catch (error) {
      logger.error('LocationService', 'Location processing failed', {
        error: error.message,
        messageId: messageData.messageId,
        coordinates: {
          latitude: locationData.latitude,
          longitude: locationData.longitude
        }
      });
      throw error;
    }
  }

  /**
   * Validate coordinates
   * @param {number} latitude - Latitude coordinate  
   * @param {number} longitude - Longitude coordinate
   * @returns {boolean} - True if coordinates are valid
   */
  static validateCoordinates(latitude, longitude) {
    if (!latitude || !longitude) {
      return false;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lng)) {
      return false;
    }

    // Check coordinate ranges
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return false;
    }

    return true;
  }

  /**
   * Extract location data from WhatsApp message content
   * @param {Object} messageContent - WhatsApp message content
   * @returns {Object} - Standardized location data
   */
  static extractLocationData(messageContent) {
    return {
      latitude: messageContent.latitude,
      longitude: messageContent.longitude,
      name: messageContent.name || null,
      address: messageContent.address || null
    };
  }
}

module.exports = LocationService;