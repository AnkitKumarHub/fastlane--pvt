/**
 * Firestore User Service
 * Handles user-related operations in Firestore Database
 */

const firestoreService = require('../firestoreService');
const MongoToFirestoreTransformer = require('../../transformers/mongoToFirestoreTransformer');
const logger = require('../../utils/logger');

class FirestoreUserService {
  
  /**
   * Initialize Firestore User Service
   */
  async initialize() {
    try {
      await firestoreService.initialize();
      logger.debug('FirestoreUserService', 'Firestore User Service initialized');
    } catch (error) {
      logger.error('FirestoreUserService', `Failed to initialize: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Sync user creation to Firestore
   */
  async syncUserCreation(mongoUser) {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreUserService', 'Service not ready, skipping user sync');
        return null;
      }

      logger.info('FirestoreUserService', 'Syncing user creation to Firestore', { 
        whatsappId: mongoUser.whatsappId 
      });

      // Transform MongoDB user to Firestore format
      const firestoreUserData = MongoToFirestoreTransformer.transformUser(mongoUser);
      
      // Validate transformed data
      MongoToFirestoreTransformer.validateFirestoreUser(firestoreUserData);

      // Save to Firestore
      const result = await firestoreService.saveUser(
        mongoUser.whatsappId,
        firestoreUserData
      );

      logger.success('FirestoreUserService', 'User creation synced successfully', { 
        whatsappId: mongoUser.whatsappId
      });

      return result;

    } catch (error) {
      logger.warn('FirestoreUserService', `Failed to sync user creation: ${error.message}`, error);
      // Don't throw - Firestore sync failures should not block MongoDB operations
      return null;
    }
  }

  /**
   * Sync user metrics update to Firestore
   */
  async syncUserMetricsUpdate(mongoUser, metricsType = 'user') {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreUserService', 'Service not ready, skipping metrics sync');
        return null;
      }

      logger.info('FirestoreUserService', 'Syncing user metrics update to Firestore', { 
        whatsappId: mongoUser.whatsappId,
        metricsType
      });

      // Transform metrics data
      const firestoreUserData = MongoToFirestoreTransformer.transformUser(mongoUser);
      
      // Update metrics in Firestore
      const result = await firestoreService.updateUserMetrics(
        mongoUser.whatsappId,
        firestoreUserData.userMetrics,
        firestoreUserData.aiMetrics,
        firestoreUserData.totalMessageCount
      );

      logger.success('FirestoreUserService', 'User metrics synced successfully', { 
        whatsappId: mongoUser.whatsappId,
        totalMessages: mongoUser.totalMessageCount
      });

      return result;

    } catch (error) {
      logger.warn('FirestoreUserService', `Failed to sync user metrics: ${error.message}`, error);
      // Don't throw - Firestore sync failures should not block MongoDB operations
      return null;
    }
  }

  /**
   * Sync user status update to Firestore
   */
  async syncUserStatusUpdate(mongoUser) {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreUserService', 'Service not ready, skipping status sync');
        return null;
      }

      logger.info('FirestoreUserService', 'Syncing user status update to Firestore', { 
        whatsappId: mongoUser.whatsappId,
        status: mongoUser.conversationStatus
      });

      // Update status in Firestore
      const result = await firestoreService.updateUserStatus(
        mongoUser.whatsappId,
        mongoUser.conversationStatus
      );

      logger.success('FirestoreUserService', 'User status synced successfully', { 
        whatsappId: mongoUser.whatsappId,
        status: mongoUser.conversationStatus
      });

      return result;

    } catch (error) {
      logger.warn('FirestoreUserService', `Failed to sync user status: ${error.message}`, error);
      // Don't throw - Firestore sync failures should not block MongoDB operations
      return null;
    }
  }

  /**
   * Sync user profile update to Firestore
   */
  async syncUserProfileUpdate(mongoUser, updatedFields = []) {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreUserService', 'Service not ready, skipping profile sync');
        return null;
      }

      logger.info('FirestoreUserService', 'Syncing user profile update to Firestore', { 
        whatsappId: mongoUser.whatsappId,
        updatedFields
      });

      // Create targeted update with only changed fields
      const updateData = MongoToFirestoreTransformer.createUserUpdate(mongoUser, updatedFields);

      // Save to Firestore
      const result = await firestoreService.saveUser(
        mongoUser.whatsappId,
        updateData
      );

      logger.success('FirestoreUserService', 'User profile synced successfully', { 
        whatsappId: mongoUser.whatsappId,
        updatedFields
      });

      return result;

    } catch (error) {
      logger.warn('FirestoreUserService', `Failed to sync user profile: ${error.message}`, error);
      // Don't throw - Firestore sync failures should not block MongoDB operations
      return null;
    }
  }

  /**
   * Sync user deactivation to Firestore
   */
  async syncUserDeactivation(mongoUser) {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreUserService', 'Service not ready, skipping deactivation sync');
        return null;
      }

      logger.info('FirestoreUserService', 'Syncing user deactivation to Firestore', { 
        whatsappId: mongoUser.whatsappId 
      });

      // Update user status to inactive
      const result = await firestoreService.saveUser(
        mongoUser.whatsappId,
        {
          isActive: false,
          updatedAt: MongoToFirestoreTransformer.timestamp()
        }
      );

      logger.success('FirestoreUserService', 'User deactivation synced successfully', { 
        whatsappId: mongoUser.whatsappId
      });

      return result;

    } catch (error) {
      logger.warn('FirestoreUserService', `Failed to sync user deactivation: ${error.message}`, error);
      // Don't throw - Firestore sync failures should not block MongoDB operations
      return null;
    }
  }

  /**
   * Sync user reactivation to Firestore
   */
  async syncUserReactivation(mongoUser) {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreUserService', 'Service not ready, skipping reactivation sync');
        return null;
      }

      logger.info('FirestoreUserService', 'Syncing user reactivation to Firestore', { 
        whatsappId: mongoUser.whatsappId 
      });

      // Update user status to active
      const result = await firestoreService.saveUser(
        mongoUser.whatsappId,
        {
          isActive: true,
          updatedAt: MongoToFirestoreTransformer.timestamp()
        }
      );

      logger.success('FirestoreUserService', 'User reactivation synced successfully', { 
        whatsappId: mongoUser.whatsappId
      });

      return result;

    } catch (error) {
      logger.warn('FirestoreUserService', `Failed to sync user reactivation: ${error.message}`, error);
      // Don't throw - Firestore sync failures should not block MongoDB operations
      return null;
    }
  }

  /**
   * Get user from Firestore for comparison/debugging
   */
  async getFirestoreUser(whatsappId) {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreUserService', 'Service not ready, cannot get Firestore user');
        return null;
      }

      const user = await firestoreService.getUser(whatsappId);
      return user ? MongoToFirestoreTransformer.firestoreDocToObject({ 
        exists: true, 
        id: whatsappId, 
        data: () => user 
      }) : null;

    } catch (error) {
      logger.warn('FirestoreUserService', `Failed to get Firestore user: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Delete user from Firestore (if needed for cleanup)
   */
  async deleteFirestoreUser(whatsappId) {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreUserService', 'Service not ready, cannot delete Firestore user');
        return null;
      }

      logger.info('FirestoreUserService', 'Deleting user from Firestore', { 
        whatsappId
      });

      const result = await firestoreService.deleteUser(whatsappId);

      logger.success('FirestoreUserService', 'User deleted from Firestore', { 
        whatsappId,
        deletedMessages: result?.deletedMessages || 0
      });

      return result;

    } catch (error) {
      logger.warn('FirestoreUserService', `Failed to delete Firestore user: ${error.message}`, error);
      return null;
    }
  }
}

// Create singleton instance
const firestoreUserService = new FirestoreUserService();

module.exports = firestoreUserService;