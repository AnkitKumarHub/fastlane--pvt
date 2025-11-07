/**
 * Database Service
 * Main service that orchestrates all database operations and provides unified API
 */

const userService = require('./userService');
const conversationService = require('./conversationService');
const mediaService = require('./mediaService');
const firestoreSyncService = require('./firestoreSyncService'); // Firestore sync
const dbConnection = require('../utils/dbConnection');
const logger = require('../utils/logger');
const validator = require('../utils/validators');
const constants = require('../utils/constants');

class DatabaseService {
  constructor() {
    this.userService = userService;
    this.conversationService = conversationService;
    this.mediaService = mediaService;
    this.isInitialized = false;
  }

  /**
   * Initialize database connection and services
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        logger.info('DatabaseService', 'Already initialized');
        return;
      }

      logger.info('DatabaseService', 'Initializing database services...');

      // Initialize MongoDB connection
      await dbConnection.connect();

      // Initialize Firebase/Media service (includes Firebase Admin with database URL)
      mediaService.initialize();

      // Initialize Firestore Sync Service
      if (constants.FIRESTORE.SYNC_ENABLED) {
        try {
          await firestoreSyncService.initialize();
          logger.success('DatabaseService', 'Firestore sync service initialized');
        } catch (error) {
          logger.warn('DatabaseService', `Firestore sync initialization failed: ${error.message}`, error);
          // Continue without Firestore sync - don't fail the main initialization
        }
      }

      this.isInitialized = true;
      logger.success('DatabaseService', 'Database services initialized successfully');

    } catch (error) {
      logger.error('DatabaseService', `Failed to initialize database services: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Process incoming WhatsApp message (complete workflow)
   */
  async processIncomingMessage(whatsappId, messageData, mediaFile = null) {
    let userResult = null; // Declare at function scope for proper access
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.webhook('INCOMING_MESSAGE', whatsappId, {
        messageId: messageData.whatsappMessageId,
        hasMedia: !!mediaFile
      });

      // Start transaction-like operation
      const startTime = Date.now();

      // 1. Find or create user
      userResult = await this.userService.findOrCreateUser({
        whatsappId,
        displayName: messageData.senderName || null,
        phoneNumber: messageData.phoneNumber || whatsappId, // Use whatsappId as phone number if not provided
        lastMessageUpdatedAt: new Date() // Initialize with current timestamp
      });
      const user = userResult.user;

      // DEBUG: Log user creation result
      // console.log('🔍 DEBUG - DatabaseService user creation result:', {
      //   whatsappId,
      //   isNewlyCreated: userResult.isNewlyCreated,
      //   userId: user._id,
      //   userExists: !!user
      // });

      // 2. Handle media upload if present
      let mediaData = null;
      if (mediaFile && mediaFile.buffer) {
        mediaData = await this.mediaService.uploadMediaFile(
          mediaFile.buffer,
          whatsappId,
          messageData.whatsappMessageId,
          mediaFile.originalName,
          mediaFile.mimeType
        );
      } else if (messageData.mediaUrl) {
        // Media was already processed and uploaded, create minimal mediaData structure
        mediaData = { 
          url: messageData.mediaUrl,
          type: messageData.mediaType || 'Unknown Type', // Default to 'Unknown Type' if type not specified
          mimeType: messageData.mimeType,
          fileName: messageData.fileName || 'unknown',
          fileSize: messageData.fileSize || 0,
          storagePath: messageData.storagePath || null, // NEW: Include storagePath
          metadata: messageData.mediaMetadata || null   // NEW: Include metadata
        };
        
        // console.log('🔍 DEBUG: mediaData created in databaseService:', JSON.stringify(mediaData, null, 2));
      }

      // 3. Prepare message data for storage
      const messageForStorage = {
        whatsappMessageId: messageData.whatsappMessageId,
        direction: constants.MESSAGE_DIRECTION.INBOUND,
        timestamp: messageData.timestamp || new Date(),
        textContent: messageData.textContent || '',
        mediaData: mediaData || undefined
      };

      // 4. Add message to conversation
      const conversation = await this.conversationService.addMessage(whatsappId, messageForStorage);

      // 5. Update user metrics
      const updatedUser = await this.userService.updateUserMetrics(
        whatsappId,
        messageData.textContent || '[Media]',
        1
      );

      const processingTime = Date.now() - startTime;

      logger.performance('PROCESS_INCOMING_MESSAGE', processingTime, {
        whatsappId,
        messageId: messageData.whatsappMessageId,
        hasMedia: !!mediaFile,
        totalMessages: updatedUser.totalMessageCount
      });

      // Firestore complete conversation sync (non-blocking)
      // This efficiently syncs both user updates and the new message in one operation
      if (constants.FIRESTORE.SYNC_ENABLED) {
        firestoreSyncService.syncCompleteConversation(updatedUser, messageForStorage).catch(error => {
          logger.warn('DatabaseService', 'Firestore complete conversation sync failed', { 
            whatsappId,
            messageId: messageData.whatsappMessageId,
            error: error.message 
          });
        });
      }

      return {
        user: updatedUser,
        conversation,
        mediaData,
        processingTimeMs: processingTime,
        isNewlyCreated: userResult ? userResult.isNewlyCreated : false // Safe access with fallback
      };

    } catch (error) {
      logger.error('DatabaseService', `Failed to process incoming message: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Process outgoing AI message (complete workflow)
   */
  async processOutgoingAiMessage(whatsappId, aiResponse, aiAuditData) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.ai('OUTGOING_MESSAGE', whatsappId, aiAuditData?.processingTimeMs, {
        messageId: aiResponse.whatsappMessageId,
        checkpointId: aiAuditData?.checkpointId
      });

      const startTime = Date.now();

      // 1. Ensure user exists
      const user = await this.userService.findUserByWhatsappId(whatsappId);
      if (!user) {
        throw new Error(`User with WhatsApp ID ${whatsappId} not found`);
      }

      // 2. Prepare message data for storage
      const messageForStorage = {
        whatsappMessageId: aiResponse.whatsappMessageId,
        direction: constants.MESSAGE_DIRECTION.OUTBOUND_AI,
        timestamp: aiResponse.timestamp || new Date(),
        textContent: aiResponse.textContent || '',
        aiAudit: aiAuditData ? {
          checkpointId: aiAuditData.checkpointId,
          processingTimeMs: aiAuditData.processingTimeMs
        } : undefined
      };

      // 3. Add message to conversation
      const conversation = await this.conversationService.addMessage(whatsappId, messageForStorage);

      // 4. Update AI metrics
      const updatedUser = await this.userService.updateAiMetrics(
        whatsappId,
        aiResponse.textContent || '[AI Response]',
        1
      );

      const processingTime = Date.now() - startTime;

      logger.performance('PROCESS_OUTGOING_AI_MESSAGE', processingTime, {
        whatsappId,
        messageId: aiResponse.whatsappMessageId,
        totalMessages: updatedUser.totalMessageCount
      });

      // Firestore complete conversation sync (non-blocking)
      if (constants.FIRESTORE.SYNC_ENABLED) {
        firestoreSyncService.syncCompleteConversation(updatedUser, messageForStorage).catch(error => {
          logger.warn('DatabaseService', 'Firestore AI message sync failed', { 
            whatsappId,
            messageId: aiResponse.whatsappMessageId,
            error: error.message 
          });
        });
      }

      return {
        user: updatedUser,
        conversation,
        processingTimeMs: processingTime
      };

    } catch (error) {
      logger.error('DatabaseService', `Failed to process outgoing AI message: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Process outgoing LM message (complete workflow with idempotency)
   */
  async processOutgoingLmMessage(whatsappId, lmResponse, clientMessageId, lmId, lmName = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('DatabaseService', 'Processing outgoing LM message', {
        whatsappId,
        messageId: lmResponse.whatsappMessageId,
        clientMessageId,
        lmId,
        lmName: lmName || 'Not provided'
      });

      const startTime = Date.now();

      // 1. Ensure user exists
      const user = await this.userService.findUserByWhatsappId(whatsappId);
      if (!user) {
        throw new Error(`User with WhatsApp ID ${whatsappId} not found`);
      }

      // 2. Check idempotency before proceeding
      const existingMessage = await this.conversationService.checkMessageIdempotency(
        whatsappId,
        clientMessageId
      );

      if (existingMessage) {
        logger.warn('DatabaseService', 'Duplicate LM message detected, skipping processing', {
          whatsappId,
          clientMessageId,
          existingMessageId: existingMessage.whatsappMessageId
        });
        
        return {
          user,
          conversation: null,
          processingTimeMs: Date.now() - startTime,
          isDuplicate: true,
          existingMessage
        };
      }

      // 3. Prepare message data for storage
      const messageForStorage = {
        whatsappMessageId: lmResponse.whatsappMessageId,
        direction: constants.MESSAGE_DIRECTION.OUTBOUND_LM,
        timestamp: lmResponse.timestamp || new Date(),
        textContent: lmResponse.textContent || '',
        clientMessageId,
        assignedLmId: lmId,
        assignedLmName: lmName // Add lmName to message storage
      };

      // 4. Add LM message to conversation
      const conversation = await this.conversationService.addLmMessage(
        whatsappId,
        messageForStorage,
        clientMessageId,
        lmId,
        lmName
      );

      // 5. Update LM metrics
      const updatedUser = await this.userService.updateLmMetrics(
        whatsappId,
        lmResponse.textContent || '[LM Response]',
        1
      );

      const processingTime = Date.now() - startTime;

      logger.performance('PROCESS_OUTGOING_LM_MESSAGE', processingTime, {
        whatsappId,
        messageId: lmResponse.whatsappMessageId,
        clientMessageId,
        lmId,
        totalMessages: updatedUser.totalMessageCount
      });

      // Firestore complete conversation sync (non-blocking)
      if (constants.FIRESTORE.SYNC_ENABLED) {
        firestoreSyncService.syncCompleteConversation(updatedUser, messageForStorage).catch(error => {
          logger.warn('DatabaseService', 'Firestore LM message sync failed', { 
            whatsappId,
            messageId: lmResponse.whatsappMessageId,
            error: error.message 
          });
        });
      }

      return {
        user: updatedUser,
        conversation,
        processingTimeMs: processingTime,
        isDuplicate: false
      };

    } catch (error) {
      // Handle duplicate message error from unique index
      if (error.message === 'DUPLICATE_MESSAGE') {
        logger.warn('DatabaseService', 'Duplicate message caught at database level', {
          whatsappId,
          clientMessageId
        });
        
        const user = await this.userService.findUserByWhatsappId(whatsappId);
        return {
          user,
          conversation: null,
          processingTimeMs: Date.now() - startTime,
          isDuplicate: true
        };
      }

      logger.error('DatabaseService', `Failed to process outgoing LM message: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Health check for all services
   */
  async healthCheck() {
    try {
      const health = {
        timestamp: new Date(),
        services: {}
      };

      // Check MongoDB connection
      try {
        health.services.mongodb = {
          status: dbConnection.isDbConnected() ? 'healthy' : 'unhealthy',
          details: dbConnection.getConnectionStats()
        };
      } catch (error) {
        health.services.mongodb = {
          status: 'error',
          error: error.message
        };
      }

      // Check Firebase
      try {
        health.services.firebase = {
          status: mediaService.bucket ? 'healthy' : 'unhealthy',
          details: {
            initialized: !!mediaService.bucket
          }
        };
      } catch (error) {
        health.services.firebase = {
          status: 'error',
          error: error.message
        };
      }

      // Check Firestore Database
      try {
        if (constants.FIRESTORE.SYNC_ENABLED) {
          const firestoreHealth = await firestoreSyncService.healthCheck();
          health.services.firestore = firestoreHealth;
        } else {
          health.services.firestore = {
            status: 'disabled',
            details: {
              syncEnabled: false
            }
          };
        }
      } catch (error) {
        health.services.firestore = {
          status: 'error',
          error: error.message
        };
      }

      // Overall health
      const allHealthy = Object.values(health.services).every(service => 
        service.status === 'healthy' || service.status === 'disabled'
      );
      health.overall = allHealthy ? 'healthy' : 'degraded';

      logger.info('DatabaseService', `Health check completed`, {
        overall: health.overall,
        mongodb: health.services.mongodb.status,
        firebase: health.services.firebase.status,
        firestore: health.services.firestore.status
      });

      return health;

    } catch (error) {
      logger.error('DatabaseService', `Health check failed: ${error.message}`, error);
      return {
        timestamp: new Date(),
        overall: 'error',
        error: error.message
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      logger.info('DatabaseService', 'Shutting down database services...');

      // Shutdown Firestore sync service
      if (constants.FIRESTORE.SYNC_ENABLED) {
        try {
          await firestoreSyncService.shutdown();
          logger.success('DatabaseService', 'Firestore sync service shut down');
        } catch (error) {
          logger.warn('DatabaseService', `Firestore sync shutdown warning: ${error.message}`, error);
          // Continue with other shutdowns
        }
      }

      await dbConnection.disconnect();
      
      this.isInitialized = false;
      
      logger.success('DatabaseService', 'Database services shut down successfully');

    } catch (error) {
      logger.error('DatabaseService', `Error during shutdown: ${error.message}`, error);
      throw error;
    }
  }

  // Legacy methods for backward compatibility
  static async storeMessage(messageObj) {
    const service = new DatabaseService();
    try {
      await service.initialize();
      
      return await service.processIncomingMessage(
        messageObj.from || messageObj.phoneNumber,
        {
          whatsappMessageId: messageObj.messageId || messageObj.id,
          textContent: messageObj.text || messageObj.body,
          timestamp: messageObj.timestamp ? new Date(messageObj.timestamp) : new Date(),
          senderName: messageObj.senderName
        }
      );
    } catch (error) {
      logger.error('DatabaseService', 'Legacy storeMessage failed', error);
      throw error;
    }
  }

  /**
   * Find message by WhatsApp message ID across all conversations
   */
  async findMessageByWhatsappId(whatsappMessageId) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.debug('DatabaseService', 'Finding message by WhatsApp ID', { whatsappMessageId });

      const result = await this.conversationService.findMessageByWhatsappId(whatsappMessageId);
      
      if (result) {
        logger.debug('DatabaseService', 'Message found', { 
          conversationId: result.conversationId,
          messageIndex: result.messageIndex
        });
        return result;
      }

      logger.debug('DatabaseService', 'Message not found', { whatsappMessageId });
      return null;

    } catch (error) {
      logger.error('DatabaseService', `Failed to find message: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update message with reaction data
   */
  async updateMessageReaction(conversationId, messageIndex, reactionData) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.debug('DatabaseService', 'Updating message reaction', { 
        conversationId,
        messageIndex,
        hasReaction: !!reactionData
      });

      const result = await this.conversationService.updateMessageReaction(
        conversationId,
        messageIndex,
        reactionData
      );

      if (result) {
        logger.success('DatabaseService', 'Message reaction updated successfully');
        return result;
      }

      logger.warn('DatabaseService', 'Failed to update message reaction');
      return null;

    } catch (error) {
      logger.error('DatabaseService', `Failed to update message reaction: ${error.message}`, error);
      throw error;
    }
  }

  // static async getMessages(phoneNumber, limit = 50) {
  //   const service = new DatabaseService();
  //   try {
  //     await service.initialize();
      
  //     const history = await service.conversationService.getConversationHistory(
  //       phoneNumber,
  //       limit
  //     );
      
  //     return history.messages || [];
  //   } catch (error) {
  //     logger.error('DatabaseService', 'Legacy getMessages failed', error);
  //     return [];
  //   }
  // }
}

// Create singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;