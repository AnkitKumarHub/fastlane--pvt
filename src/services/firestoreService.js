/**
 * Firestore Service
 * Core CRUD operations for Firestore Database
 */

const firestoreConfig = require('../utils/firestoreConfig');
const logger = require('../utils/logger');
const constants = require('../utils/constants');
const admin = require('firebase-admin');

class FirestoreService {
  constructor() {
    this.isInitialized = false;
    this.firestore = null;
  }

  /**
   * Initialize Firestore service
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        logger.debug('FirestoreService', 'Already initialized');
        return;
      }

      if (!constants.FIRESTORE.SYNC_ENABLED) {
        logger.info('FirestoreService', 'Firestore sync is disabled');
        return;
      }

      await firestoreConfig.initialize();
      this.firestore = firestoreConfig.getFirestore();
      this.isInitialized = true;

      logger.success('FirestoreService', 'Firestore service initialized successfully');

    } catch (error) {
      logger.error('FirestoreService', `Failed to initialize: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return this.isInitialized && constants.FIRESTORE.SYNC_ENABLED;
  }

  /**
   * Save or update user document in Firestore
   */
  async saveUser(whatsappId, userData) {
    try {
      if (!this.isReady()) {
        logger.debug('FirestoreService', 'Service not ready, skipping user save');
        return null;
      }

      logger.database('FIRESTORE_SAVE_USER', 'User', { whatsappId });

      const userDocRef = firestoreConfig.getUserDocRef(whatsappId);
      
      // Use merge to update existing document or create new one
      await userDocRef.set(userData, { merge: true });

      logger.success('FirestoreService', 'User saved successfully', { 
        whatsappId,
        fields: Object.keys(userData)
      });

      return { success: true, whatsappId };

    } catch (error) {
      logger.error('FirestoreService', `Failed to save user: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Save message to Firestore (using auto-generated document ID)
   */
  async saveMessage(whatsappId, whatsappMessageId, messageData) {
    try {
      if (!this.isReady()) {
        logger.debug('FirestoreService', 'Service not ready, skipping message save');
        return null;
      }

      logger.database('FIRESTORE_SAVE_MESSAGE', 'Message', { whatsappId, whatsappMessageId });

      // Get messages collection reference for this user
      const messagesCollectionRef = firestoreConfig.getUserMessagesCollectionRef(whatsappId);
      
      // Use add() to auto-generate Firestore document ID
      const docRef = await messagesCollectionRef.add(messageData);
      const firestoreMessageId = docRef.id;

      logger.success('FirestoreService', 'Message saved successfully', { 
        whatsappId,
        whatsappMessageId,
        firestoreMessageId,
        direction: messageData.direction
      });

      return { success: true, whatsappId, whatsappMessageId, firestoreMessageId };

    } catch (error) {
      logger.error('FirestoreService', `Failed to save message: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update user metrics only
   */
  async updateUserMetrics(whatsappId, userMetrics, aiMetrics, totalMessageCount) {
    try {
      if (!this.isReady()) {
        logger.debug('FirestoreService', 'Service not ready, skipping metrics update');
        return null;
      }

      logger.database('FIRESTORE_UPDATE_METRICS', 'User', { whatsappId });

      const updateData = {
        totalMessageCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (userMetrics) {
        updateData.userMetrics = userMetrics;
      }

      if (aiMetrics) {
        updateData.aiMetrics = aiMetrics;
      }

      const userDocRef = firestoreConfig.getUserDocRef(whatsappId);
      await userDocRef.update(updateData);

      logger.success('FirestoreService', 'User metrics updated successfully', { 
        whatsappId,
        totalMessageCount
      });

      return { success: true, whatsappId };

    } catch (error) {
      logger.error('FirestoreService', `Failed to update user metrics: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update user status
   */
  async updateUserStatus(whatsappId, conversationStatus) {
    try {
      if (!this.isReady()) {
        logger.debug('FirestoreService', 'Service not ready, skipping status update');
        return null;
      }

      logger.database('FIRESTORE_UPDATE_STATUS', 'User', { whatsappId, conversationStatus });

      const updateData = {
        conversationStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const userDocRef = firestoreConfig.getUserDocRef(whatsappId);
      await userDocRef.update(updateData);

      logger.success('FirestoreService', 'User status updated successfully', { 
        whatsappId,
        conversationStatus
      });

      return { success: true, whatsappId };

    } catch (error) {
      logger.error('FirestoreService', `Failed to update user status: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get user document from Firestore
   */
  async getUser(whatsappId) {
    try {
      if (!this.isReady()) {
        logger.debug('FirestoreService', 'Service not ready, skipping user get');
        return null;
      }

      logger.database('FIRESTORE_GET_USER', 'User', { whatsappId });

      const userDocRef = firestoreConfig.getUserDocRef(whatsappId);
      const doc = await userDocRef.get();

      if (!doc.exists) {
        logger.debug('FirestoreService', 'User not found in Firestore', { whatsappId });
        return null;
      }

      const userData = doc.data();
      logger.success('FirestoreService', 'User retrieved successfully', { 
        whatsappId
      });

      return userData;

    } catch (error) {
      logger.error('FirestoreService', `Failed to get user: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get user messages from Firestore with optional WhatsApp message ID filtering
   */
  async getUserMessages(whatsappId, limit = 50, whatsappMessageId = null) {
    try {
      if (!this.isReady()) {
        logger.debug('FirestoreService', 'Service not ready, skipping messages get');
        return [];
      }

      logger.database('FIRESTORE_GET_MESSAGES', 'Messages', { whatsappId, limit, whatsappMessageId });

      const messagesCollectionRef = firestoreConfig.getUserMessagesCollectionRef(whatsappId);
      
      let query;
      if (whatsappMessageId) {
        // Query for specific WhatsApp message ID
        query = messagesCollectionRef
          .where('whatsappMessageId', '==', whatsappMessageId)
          .limit(1);
      } else {
        // Get latest messages ordered by timestamp
        query = messagesCollectionRef
          .orderBy('timestamp', 'desc')
          .limit(limit);
      }
      
      const querySnapshot = await query.get();

      if (querySnapshot.empty) {
        logger.debug('FirestoreService', 'No messages found in Firestore', { whatsappId });
        return [];
      }

      const messages = [];
      querySnapshot.forEach(doc => {
        messages.push({
          firestoreMessageId: doc.id,
          ...doc.data()
        });
      });

      logger.success('FirestoreService', 'Messages retrieved successfully', { 
        whatsappId,
        messageCount: messages.length
      });

      return messages;

    } catch (error) {
      logger.error('FirestoreService', `Failed to get messages: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Delete user and all associated data from Firestore
   */
  async deleteUser(whatsappId) {
    try {
      if (!this.isReady()) {
        logger.debug('FirestoreService', 'Service not ready, skipping user delete');
        return null;
      }

      logger.database('FIRESTORE_DELETE_USER', 'User', { whatsappId });

      const batch = firestoreConfig.batch();

      // Delete user document
      const userDocRef = firestoreConfig.getUserDocRef(whatsappId);
      batch.delete(userDocRef);

      // Delete all messages in subcollection
      const messagesCollectionRef = firestoreConfig.getUserMessagesCollectionRef(whatsappId);
      const messagesSnapshot = await messagesCollectionRef.get();
      
      messagesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Execute batch delete
      await batch.commit();

      logger.success('FirestoreService', 'User and messages deleted successfully', { 
        whatsappId,
        deletedMessages: messagesSnapshot.size
      });

      return { success: true, whatsappId, deletedMessages: messagesSnapshot.size };

    } catch (error) {
      logger.error('FirestoreService', `Failed to delete user: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Batch operations for better performance
   */
  async batchUpdate(whatsappId, userData, whatsappMessageId = null, messageData = null) {
    try {
      if (!this.isReady()) {
        logger.debug('FirestoreService', 'Service not ready, skipping batch update');
        return null;
      }

      logger.database('FIRESTORE_BATCH_UPDATE', 'User+Message', { whatsappId, hasMessage: !!whatsappMessageId });

      const batch = firestoreConfig.batch();
      let operations = 0;

      // User updates
      const userDocRef = firestoreConfig.getUserDocRef(whatsappId);
      batch.set(userDocRef, userData, { merge: true });
      operations++;

      // Message updates - if we have new message data, add it
      if (whatsappMessageId && messageData) {
        const messagesCollectionRef = firestoreConfig.getUserMessagesCollectionRef(whatsappId);
        const messageDocRef = messagesCollectionRef.doc(); // Auto-generate ID
        batch.set(messageDocRef, messageData);
        operations++;
        
        logger.debug('FirestoreService', 'Message added to batch update', { 
          whatsappId,
          whatsappMessageId,
          firestoreMessageId: messageDocRef.id
        });
      }

      // Execute batch
      await batch.commit();

      logger.success('FirestoreService', 'Batch update completed successfully', { 
        whatsappId,
        operations
      });

      return { success: true, whatsappId, operations };

    } catch (error) {
      logger.error('FirestoreService', `Failed to perform batch update: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Health check for Firestore
   */
  async healthCheck() {
    try {
      if (!constants.FIRESTORE.SYNC_ENABLED) {
        return {
          status: 'disabled',
          message: 'Firestore sync is disabled'
        };
      }

      if (!this.isReady()) {
        return {
          status: 'not_ready',
          message: 'Firestore service not initialized'
        };
      }

      // Test connection with a simple query
      const testCollection = this.firestore.collection('health-check');
      await testCollection.limit(1).get();

      return {
        status: 'healthy',
        message: 'Firestore Database is connected',
        timestamp: new Date().toISOString(),
        config: firestoreConfig.getConfigInfo()
      };

    } catch (error) {
      logger.error('FirestoreService', `Health check failed: ${error.message}`, error);
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Verify data exists in Firestore (debugging helper)
   */
  async verifyDataInFirestore(whatsappId) {
    try {
      if (!this.isReady()) {
        return {
          success: false,
          error: 'Firestore service not ready'
        };
      }

      logger.info('FirestoreService', `Verifying data for WhatsApp ID: ${whatsappId}`);

      // Check if user exists
      const user = await this.getUser(whatsappId);
      const userExists = !!user;

      // Check messages
      const messages = await this.getUserMessages(whatsappId, 100);
      const messageCount = messages.length;

      // Get collection overview
      const collectionRef = firestoreConfig.getCollectionRef();
      const collectionSnapshot = await collectionRef.limit(10).get();
      const totalUsers = collectionSnapshot.size;
      const userList = [];
      collectionSnapshot.forEach(doc => {
        userList.push(doc.id);
      });

      const result = {
        success: true,
        whatsappId,
        userExists,
        user: userExists ? {
          displayName: user.displayName,
          phoneNumber: user.phoneNumber,
          totalMessageCount: user.totalMessageCount,
          conversationStatus: user.conversationStatus
        } : null,
        messageCount,
        recentMessages: messages.slice(0, 3).map(msg => ({
          firestoreId: msg.firestoreMessageId,
          whatsappMessageId: msg.whatsappMessageId,
          direction: msg.direction,
          textContent: msg.textContent?.substring(0, 50) + '...'
        })),
        collectionInfo: {
          totalUsers,
          userList: userList.slice(0, 5) // First 5 users
        }
      };

      logger.success('FirestoreService', 'Data verification completed', result);
      return result;

    } catch (error) {
      logger.error('FirestoreService', `Data verification failed: ${error.message}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      if (this.isInitialized) {
        await firestoreConfig.shutdown();
        this.firestore = null;
        this.isInitialized = false;
        logger.info('FirestoreService', 'Firestore service shut down successfully');
      }
    } catch (error) {
      logger.error('FirestoreService', `Error during shutdown: ${error.message}`, error);
      throw error;
    }
  }
}

// Create singleton instance
const firestoreService = new FirestoreService();

module.exports = firestoreService;