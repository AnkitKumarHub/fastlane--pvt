/**
 * Geocoding Service
 * Handles reverse geocoding using Google Maps API
 * Converts coordinates to human-readable addresses
 */

const axios = require('axios');
const logger = require('../utils/logger');

class GeocodingService {
  
  /**
   * Reverse geocode coordinates to get address information
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Object} - Address information with name and formatted address
   */
  static async reverseGeocode(latitude, longitude) {
    try {
      // Check if geocoding is enabled
      if (process.env.ENABLE_LOCATION_GEOCODING !== 'true') {
        logger.info('GeocodingService', 'Geocoding disabled, returning null values');
        return { name: null, address: null };
      }

      // Check if API key is available
      if (!process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key_here') {
        logger.warn('GeocodingService', 'Google Maps API key not configured');
        return { name: null, address: null };
      }

      logger.debug('GeocodingService', 'Starting reverse geocoding', {
        latitude,
        longitude
      });

      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      
      const response = await axios.get(url);
      const data = response.data;

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        
        // Extract place name (first component or business name)
        let placeName = null;
        if (result.address_components && result.address_components.length > 0) {
          // Try to find a meaningful place name
          const nameComponent = result.address_components.find(comp => 
            comp.types.includes('establishment') || 
            comp.types.includes('point_of_interest') ||
            comp.types.includes('premise')
          );
          placeName = nameComponent ? nameComponent.long_name : result.address_components[0].long_name;
        }

        logger.info('GeocodingService', 'Reverse geocoding successful', {
          placeName,
          address: result.formatted_address
        });

        return {
          name: placeName,
          address: result.formatted_address
        };
      }

      // Handle API errors
      if (data.status === 'ZERO_RESULTS') {
        logger.info('GeocodingService', 'No results found for coordinates', { latitude, longitude });
      } else if (data.status === 'OVER_QUERY_LIMIT') {
        logger.warn('GeocodingService', 'Google Maps API quota exceeded');
      } else {
        logger.warn('GeocodingService', 'Geocoding API error', { status: data.status });
      }

      return { name: null, address: null };

    } catch (error) {
      logger.error('GeocodingService', 'Reverse geocoding failed', {
        error: error.message,
        status: error.response?.status,
        latitude,
        longitude
      });
      
      // Return null values on error to allow location processing to continue
      return { name: null, address: null };
    }
  }

  /**
   * Validate coordinates before geocoding
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {boolean} - True if coordinates are valid
   */
  static validateCoordinates(latitude, longitude) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    return (
      !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180
    );
  }
}

module.exports = GeocodingService;