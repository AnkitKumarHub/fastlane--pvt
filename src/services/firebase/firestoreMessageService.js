/**
 * Firestore Message Service
 * Handles message-related operations in Firestore Database
 */

const firestoreService = require('../firestoreService');
const MongoToFirestoreTransformer = require('../../transformers/mongoToFirestoreTransformer');
const firestoreConfig = require('../../utils/firestoreConfig');
const logger = require('../../utils/logger');

class FirestoreMessageService {
  
  /**
   * Initialize Firestore Message Service
   */
  async initialize() {
    try {
      await firestoreService.initialize();
      logger.debug('FirestoreMessageService', 'Firestore Message Service initialized');
    } catch (error) {
      logger.error('FirestoreMessageService', `Failed to initialize: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Check if Firestore Message Service is ready
   */
  isReady() {
    return firestoreService.isReady();
  }

  /**
   * Sync multiple messages in batch for better performance
   */
  async syncMessagesBatch(whatsappId, mongoMessages) {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreMessageService', 'Service not ready, skipping batch message sync');
        return null;
      }

      if (!Array.isArray(mongoMessages) || mongoMessages.length === 0) {
        logger.debug('FirestoreMessageService', 'No messages to sync', { whatsappId });
        return null;
      }

      logger.info('FirestoreMessageService', 'Syncing messages batch to Firestore', { 
        whatsappId,
        messageCount: mongoMessages.length
      });

      const results = [];

      // Process messages in smaller batches to respect Firestore limits (500 operations per batch)
      const batchSize = 100; // Conservative batch size for message operations
      for (let i = 0; i < mongoMessages.length; i += batchSize) {
        const batch = mongoMessages.slice(i, i + batchSize);
        
        const batchPromises = batch.map(message => 
          this.syncMessageAddition(whatsappId, message)
        );

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        // Small delay between batches to be respectful to Firestore
        if (i + batchSize < mongoMessages.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
      const failureCount = results.length - successCount;

      logger.success('FirestoreMessageService', 'Message batch sync completed', { 
        whatsappId,
        totalMessages: mongoMessages.length,
        successful: successCount,
        failed: failureCount
      });

      return { 
        success: true, 
        whatsappId, 
        totalMessages: mongoMessages.length,
        successful: successCount,
        failed: failureCount
      };

    } catch (error) {
      logger.warn('FirestoreMessageService', `Failed to sync message batch: ${error.message}`, error);
      // Don't throw - Firestore sync failures should not block MongoDB operations
      return null;
    }
  }

  /**
   * Sync conversation (user + messages) in a single batch operation
   */
  async syncCompleteConversation(mongoUser, mongoMessages = []) {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreMessageService', 'Service not ready, skipping conversation sync');
        return null;
      }

      logger.info('FirestoreMessageService', 'Syncing complete conversation to Firestore', { 
        whatsappId: mongoUser.whatsappId,
        messageCount: mongoMessages.length
      });

      // Transform user and messages
      const firestoreUserData = MongoToFirestoreTransformer.transformUser(mongoUser);
      
      let whatsappMessageId = null;
      let firestoreMessageData = null;

      // If there's a new message, prepare it for batch update
      if (mongoMessages.length > 0) {
        const latestMessage = mongoMessages[0]; // Assuming first message is the latest
        if (latestMessage.whatsappMessageId) {
          whatsappMessageId = latestMessage.whatsappMessageId;
          firestoreMessageData = MongoToFirestoreTransformer.transformMessage(latestMessage);
          
          // Validate message data
          MongoToFirestoreTransformer.validateFirestoreMessage(firestoreMessageData);
        }
      }

      // Use batch update for better performance
      const result = await firestoreService.batchUpdate(
        mongoUser.whatsappId,
        firestoreUserData,
        whatsappMessageId,
        firestoreMessageData
      );

      logger.success('FirestoreMessageService', 'Complete conversation synced successfully', { 
        whatsappId: mongoUser.whatsappId,
        hasNewMessage: !!whatsappMessageId
      });

      return result;

    } catch (error) {
      logger.warn('FirestoreMessageService', `Failed to sync complete conversation: ${error.message}`, error);
      // Don't throw - Firestore sync failures should not block MongoDB operations
      return null;
    }
  }

  /**
   * Get messages from Firestore with optional WhatsApp message ID filter
   */
  async getFirestoreMessages(whatsappId, limit = 50, whatsappMessageId = null) {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreMessageService', 'Service not ready, cannot get Firestore messages');
        return [];
      }

      const messages = await firestoreService.getUserMessages(whatsappId, limit, whatsappMessageId);
      
      // Convert Firestore documents to plain objects
      return messages.map(message => 
        MongoToFirestoreTransformer.firestoreDocToObject({
          exists: true,
          id: message.firestoreMessageId,
          data: () => message
        })
      );

    } catch (error) {
      logger.warn('FirestoreMessageService', `Failed to get Firestore messages: ${error.message}`, error);
      return [];
    }
  }

  /**
   * Delete message from Firestore using WhatsApp message ID
   */
  async deleteFirestoreMessage(whatsappId, whatsappMessageId) {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreMessageService', 'Service not ready, cannot delete Firestore message');
        return null;
      }

      logger.info('FirestoreMessageService', 'Deleting message from Firestore', { 
        whatsappId,
        whatsappMessageId
      });

      // First, find the Firestore message document by querying WhatsApp message ID
      const messages = await this.getFirestoreMessages(whatsappId, 1000, whatsappMessageId);
      
      if (messages.length === 0) {
        logger.debug('FirestoreMessageService', 'Message not found in Firestore', { 
          whatsappId,
          whatsappMessageId
        });
        return null;
      }

      // Delete each matching message (should typically be just one)
      const deletePromises = messages.map(async (message) => {
        const messageDocRef = firestoreConfig.getMessageDocRef(whatsappId, message.id);
        await messageDocRef.delete();
        return message.id;
      });

      const deletedIds = await Promise.all(deletePromises);

      logger.success('FirestoreMessageService', 'Message deleted from Firestore', { 
        whatsappId,
        whatsappMessageId,
        deletedFirestoreIds: deletedIds
      });

      return { success: true, whatsappId, whatsappMessageId, deletedCount: deletedIds.length };

    } catch (error) {
      logger.warn('FirestoreMessageService', `Failed to delete Firestore message: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Archive old messages in Firestore (keep only recent N messages)
   */
  async archiveOldMessages(whatsappId, keepRecent = 1000) {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreMessageService', 'Service not ready, cannot archive messages');
        return null;
      }

      logger.info('FirestoreMessageService', 'Archiving old messages in Firestore', { 
        whatsappId,
        keepRecent
      });

      // Get all messages ordered by timestamp (descending - newest first)
      const messages = await this.getFirestoreMessages(whatsappId, 10000); // Get more than we need
      
      if (messages.length <= keepRecent) {
        logger.debug('FirestoreMessageService', 'No archiving needed', { 
          whatsappId,
          currentCount: messages.length,
          keepRecent
        });
        return { success: true, whatsappId, archivedCount: 0 };
      }

      // Sort by timestamp and keep only recent messages
      const sortedMessages = messages.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      
      const messagesToDelete = sortedMessages.slice(keepRecent);
      
      // Delete old messages in batches
      const batchSize = 100;
      let archivedCount = 0;
      
      for (let i = 0; i < messagesToDelete.length; i += batchSize) {
        const batch = messagesToDelete.slice(i, i + batchSize);
        
        const deletePromises = batch.map(message => 
          this.deleteFirestoreMessage(whatsappId, message.whatsappMessageId)
        );
        
        await Promise.allSettled(deletePromises);
        archivedCount += batch.length;
        
        // Small delay between batches
        if (i + batchSize < messagesToDelete.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.success('FirestoreMessageService', 'Old messages archived successfully', { 
        whatsappId,
        archivedCount,
        remainingCount: keepRecent
      });

      return { 
        success: true, 
        whatsappId, 
        archivedCount 
      };

    } catch (error) {
      logger.warn('FirestoreMessageService', `Failed to archive old messages: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Update message reaction in Firestore
   */
  async updateMessageReaction(conversationId, whatsappMessageId, reactionData) {
    try {
      if (!firestoreService.isReady()) {
        logger.debug('FirestoreMessageService', 'Service not ready, skipping reaction update');
        return null;
      }

      logger.info('FirestoreMessageService', 'Updating message reaction in Firestore', { 
        conversationId,
        whatsappMessageId,
        hasReaction: !!reactionData
      });

      // Find the Firestore message document by WhatsApp message ID
      const messages = await this.getFirestoreMessages(conversationId, 1000, whatsappMessageId);
      
      if (messages.length === 0) {
        logger.debug('FirestoreMessageService', 'Message not found in Firestore for reaction update', { 
          conversationId,
          whatsappMessageId
        });
        return null;
      }

      // Update each matching message (should typically be just one)
      const updatePromises = messages.map(async (message) => {
        try {
          const messageDocRef = firestoreConfig.getMessageDocRef(conversationId, message.id);
          
          // Prepare reaction update
          const updateData = {
            updatedAt: firestoreConfig.serverTimestamp()
          };

          if (reactionData && reactionData.emoji) {
            // Add or update reaction
            updateData.reaction = {
              emoji: reactionData.emoji,
              timestamp: reactionData.timestamp ? 
                firestoreConfig.timestamp(reactionData.timestamp) : firestoreConfig.serverTimestamp(),
              reactedBy: reactionData.reactedBy
            };
          } else {
            // Remove reaction (set to null)
            updateData.reaction = null;
          }

          await messageDocRef.update(updateData);
          return message.id;
        } catch (updateError) {
          logger.error('FirestoreMessageService', `Failed to update individual message: ${updateError.message}`, updateError);
          throw updateError;
        }
      });

      const updatedIds = await Promise.all(updatePromises);

      logger.success('FirestoreMessageService', 'Message reaction updated in Firestore', { 
        conversationId,
        whatsappMessageId,
        updatedCount: updatedIds.length,
        reactionEmoji: reactionData?.emoji || '[REMOVED]'
      });

      return { 
        success: true, 
        conversationId, 
        whatsappMessageId, 
        updatedCount: updatedIds.length,
        reaction: reactionData
      };

    } catch (error) {
      logger.warn('FirestoreMessageService', `Failed to update message reaction: ${error.message}`, error);
      return null;
    }
  }
}

// Create singleton instance
const firestoreMessageService = new FirestoreMessageService();

module.exports = firestoreMessageService;