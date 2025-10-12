/**
 * Firestore Sync Service
 * Orchestrates all Firestore synchronization operations with error handling and retry logic
 */

const firestoreUserService = require('./firebase/firestoreUserService');
const firestoreMessageService = require('./firebase/firestoreMessageService');
const logger = require('../utils/logger');
const constants = require('../utils/constants');

class FirestoreSyncService {
  constructor() {
    this.isInitialized = false;
    this.syncStats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastSyncTime: null
    };
  }

  /**
   * Initialize Firestore Sync Service
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        logger.debug('FirestoreSyncService', 'Already initialized');
        return;
      }

      if (!constants.FIRESTORE.SYNC_ENABLED) {
        logger.info('FirestoreSyncService', 'Firestore sync is disabled by configuration');
        return;
      }

      // Initialize Firestore services
      await firestoreUserService.initialize();
      await firestoreMessageService.initialize();

      this.isInitialized = true;
      logger.success('FirestoreSyncService', 'Firestore Sync Service initialized successfully');

    } catch (error) {
      logger.error('FirestoreSyncService', `Failed to initialize: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Check if sync service is ready and enabled
   */
  isReady() {
    return this.isInitialized && constants.FIRESTORE.SYNC_ENABLED;
  }

  /**
   * Sync user creation (called after MongoDB user creation)
   */
  async syncUserCreation(mongoUser) {
    return this.executeSync('USER_CREATION', async () => {
      logger.info('FirestoreSyncService', 'Syncing user creation', { 
        whatsappId: mongoUser.whatsappId 
      });

      const result = await firestoreUserService.syncUserCreation(mongoUser);
      
      logger.success('FirestoreSyncService', 'User creation sync completed', { 
        whatsappId: mongoUser.whatsappId,
        success: !!result
      });

      return result;
    });
  }

  /**
   * Sync user metrics update (called after MongoDB metrics update)
   */
  async syncUserMetricsUpdate(mongoUser, metricsType = 'user') {
    return this.executeSync('USER_METRICS_UPDATE', async () => {
      logger.info('FirestoreSyncService', 'Syncing user metrics update', { 
        whatsappId: mongoUser.whatsappId,
        metricsType,
        totalMessages: mongoUser.totalMessageCount
      });

      const result = await firestoreUserService.syncUserMetricsUpdate(mongoUser, metricsType);
      
      logger.success('FirestoreSyncService', 'User metrics sync completed', { 
        whatsappId: mongoUser.whatsappId,
        success: !!result
      });

      return result;
    });
  }

  /**
   * Sync user status update (called after MongoDB status update)
   */
  async syncUserStatusUpdate(mongoUser) {
    return this.executeSync('USER_STATUS_UPDATE', async () => {
      logger.info('FirestoreSyncService', 'Syncing user status update', { 
        whatsappId: mongoUser.whatsappId,
        status: mongoUser.conversationStatus
      });

      const result = await firestoreUserService.syncUserStatusUpdate(mongoUser);
      
      logger.success('FirestoreSyncService', 'User status sync completed', { 
        whatsappId: mongoUser.whatsappId,
        success: !!result
      });

      return result;
    });
  }

  /**
   * Sync user profile update (called after MongoDB profile update)
   */
  async syncUserProfileUpdate(mongoUser, updatedFields = []) {
    return this.executeSync('USER_PROFILE_UPDATE', async () => {
      logger.info('FirestoreSyncService', 'Syncing user profile update', { 
        whatsappId: mongoUser.whatsappId,
        updatedFields
      });

      const result = await firestoreUserService.syncUserProfileUpdate(mongoUser, updatedFields);
      
      logger.success('FirestoreSyncService', 'User profile sync completed', { 
        whatsappId: mongoUser.whatsappId,
        success: !!result
      });

      return result;
    });
  }

  /**
   * Sync complete conversation (user + message) - efficient batch operation
   * This syncs both user data and messages together for data consistency
   */
  async syncCompleteConversation(mongoUser, mongoMessage = null) {
    return this.executeSync('COMPLETE_CONVERSATION', async () => {
      logger.info('FirestoreSyncService', 'Syncing complete conversation', { 
        whatsappId: mongoUser.whatsappId,
        hasNewMessage: !!mongoMessage
      });

      // Use the batch operation for better performance
      const messages = mongoMessage ? [mongoMessage] : [];
      const result = await firestoreMessageService.syncCompleteConversation(mongoUser, messages);
      
      logger.success('FirestoreSyncService', 'Complete conversation sync completed', { 
        whatsappId: mongoUser.whatsappId,
        success: !!result
      });

      return result;
    });
  }

  /**
   * Sync user deactivation
   */
  async syncUserDeactivation(mongoUser) {
    return this.executeSync('USER_DEACTIVATION', async () => {
      logger.info('FirestoreSyncService', 'Syncing user deactivation', { 
        whatsappId: mongoUser.whatsappId 
      });

      const result = await firestoreUserService.syncUserDeactivation(mongoUser);
      
      logger.success('FirestoreSyncService', 'User deactivation sync completed', { 
        whatsappId: mongoUser.whatsappId,
        success: !!result
      });

      return result;
    });
  }

  /**
   * Sync user reactivation
   */
  async syncUserReactivation(mongoUser) {
    return this.executeSync('USER_REACTIVATION', async () => {
      logger.info('FirestoreSyncService', 'Syncing user reactivation', { 
        whatsappId: mongoUser.whatsappId 
      });

      const result = await firestoreUserService.syncUserReactivation(mongoUser);
      
      logger.success('FirestoreSyncService', 'User reactivation sync completed', { 
        whatsappId: mongoUser.whatsappId,
        success: !!result
      });

      return result;
    });
  }

  /**
   * Execute sync operation with error handling and stats tracking
   */
  async executeSync(operationType, syncOperation) {
    if (!this.isReady()) {
      logger.debug('FirestoreSyncService', `Sync disabled or not ready, skipping ${operationType}`);
      return null;
    }

    const startTime = Date.now();
    this.syncStats.totalSyncs++;

    try {
      const result = await syncOperation();
      
      this.syncStats.successfulSyncs++;
      this.syncStats.lastSyncTime = new Date();

      const duration = Date.now() - startTime;
      logger.performance('FIRESTORE_SYNC', duration, {
        operationType,
        success: true
      });

      return result;

    } catch (error) {
      this.syncStats.failedSyncs++;
      
      const duration = Date.now() - startTime;
      logger.warn('FirestoreSyncService', `${operationType} sync failed`, {
        error: error.message,
        duration
      });

      logger.performance('FIRESTORE_SYNC', duration, {
        operationType,
        success: false,
        error: error.message
      });

      // Don't throw - Firestore sync failures should not block MongoDB operations
      return null;
    }
  }

  /**
   * Get sync statistics
   */
  getSyncStats() {
    return {
      ...this.syncStats,
      isEnabled: constants.FIRESTORE.SYNC_ENABLED,
      isReady: this.isReady(),
      successRate: this.syncStats.totalSyncs > 0 ? 
        (this.syncStats.successfulSyncs / this.syncStats.totalSyncs * 100).toFixed(2) + '%' : 
        'N/A'
    };
  }

  /**
   * Reset sync statistics
   */
  resetSyncStats() {
    this.syncStats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastSyncTime: null
    };
    logger.info('FirestoreSyncService', 'Sync statistics reset');
  }

  /**
   * Health check for Firestore sync service
   */
  async healthCheck() {
    try {
      const stats = this.getSyncStats();
      
      if (!constants.FIRESTORE.SYNC_ENABLED) {
        return {
          status: 'disabled',
          message: 'Firestore sync is disabled by configuration',
          stats
        };
      }

      if (!this.isReady()) {
        return {
          status: 'not_ready',
          message: 'Firestore sync service not initialized',
          stats
        };
      }

      // Test Firestore services
      const userServiceHealth = await firestoreUserService.getFirestoreUser('health_check_test');
      const messageServiceHealth = await firestoreMessageService.getFirestoreMessages('health_check_test', 1);

      return {
        status: 'healthy',
        message: 'Firestore sync service is operational',
        stats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('FirestoreSyncService', `Health check failed: ${error.message}`, error);
      return {
        status: 'error',
        message: error.message,
        stats: this.getSyncStats(),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Verify data in Firestore (debugging helper)
   */
  async verifyDataInFirestore(whatsappId) {
    try {
      if (!this.isReady()) {
        return {
          success: false,
          error: 'Firestore sync service not ready'
        };
      }

      logger.info('FirestoreSyncService', `Verifying Firestore data for WhatsApp ID: ${whatsappId}`);

      // Get user data
      const user = await firestoreUserService.getFirestoreUser(whatsappId);
      
      // Get messages
      const messages = await firestoreMessageService.getFirestoreMessages(whatsappId, 100);

      const result = {
        success: true,
        whatsappId,
        userExists: !!user,
        user: user ? {
          displayName: user.displayName,
          phoneNumber: user.phoneNumber,
          totalMessageCount: user.totalMessageCount,
          conversationStatus: user.conversationStatus
        } : null,
        messageCount: messages.length,
        recentMessages: messages.slice(0, 5).map(msg => ({
          firestoreId: msg.id,
          whatsappMessageId: msg.whatsappMessageId,
          direction: msg.direction,
          textContent: msg.textContent?.substring(0, 50) + '...'
        })),
        syncStats: this.getSyncStats()
      };

      logger.success('FirestoreSyncService', 'Firestore data verification completed', result);
      return result;

    } catch (error) {
      logger.error('FirestoreSyncService', `Firestore data verification failed: ${error.message}`, error);
      return {
        success: false,
        error: error.message,
        syncStats: this.getSyncStats()
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      logger.info('FirestoreSyncService', 'Shutting down Firestore sync service...');
      
      // Log final stats
      const finalStats = this.getSyncStats();
      logger.info('FirestoreSyncService', 'Final sync statistics', finalStats);

      this.isInitialized = false;
      
      logger.success('FirestoreSyncService', 'Firestore sync service shut down successfully');

    } catch (error) {
      logger.error('FirestoreSyncService', `Error during shutdown: ${error.message}`, error);
      throw error;
    }
  }
}

// Create singleton instance
const firestoreSyncService = new FirestoreSyncService();

module.exports = firestoreSyncService;