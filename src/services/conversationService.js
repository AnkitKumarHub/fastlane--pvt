/**
 * Conversation Service (Streamlined)
 * Handles essential conversation-related database operations
 */

const { Conversation } = require('../models');
const logger = require('../utils/logger');
const validator = require('../utils/validators');
const constants = require('../utils/constants');
const firestoreSyncService = require('./firestoreSyncService'); // Firestore sync

class ConversationService {
  constructor() {
    this.modelName = 'Conversation';
  }

  /**
   * Create a new conversation
   */
  async createConversation(conversationId) {
    try {
      validator.validateWhatsappId(conversationId); // conversationId is same as whatsappId
      
      logger.database('CREATE', this.modelName, { conversationId });

      // Check if conversation already exists
      const existingConversation = await Conversation.findByConversationId(conversationId);
      if (existingConversation) {
        logger.debug('ConversationService', `Conversation already exists`, { conversationId });
        return existingConversation;
      }

      // Create new conversation
      const conversation = new Conversation({
        conversationId,
        messages: []
      });

      const savedConversation = await conversation.save();

      logger.success('ConversationService', `Conversation created successfully`, { 
        conversationId,
        conversationDbId: savedConversation._id 
      });

      return savedConversation;

    } catch (error) {
      logger.error('ConversationService', `Failed to create conversation: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Find conversation by conversation ID
   */
  async findConversation(conversationId) {
    try {
      validator.validateWhatsappId(conversationId);
      
      logger.database('FIND', this.modelName, { conversationId });

      const conversation = await Conversation.findByConversationId(conversationId);
      
      if (!conversation) {
        logger.debug('ConversationService', `Conversation not found`, { conversationId });
        return null;
      }

      logger.debug('ConversationService', `Conversation found`, { 
        conversationId,
        messageCount: conversation.messages.length,
        lastUpdated: conversation.lastUpdated
      });

      return conversation;

    } catch (error) {
      logger.error('ConversationService', `Failed to find conversation: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Find or create conversation (upsert operation)
   */
  async findOrCreateConversation(conversationId) {
    try {
      const existingConversation = await this.findConversation(conversationId);
      
      if (existingConversation) {
        return existingConversation;
      }

      logger.info('ConversationService', `Conversation not found, creating new conversation`, { 
        conversationId 
      });
      return await this.createConversation(conversationId);

    } catch (error) {
      logger.error('ConversationService', `Failed to find or create conversation: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Add a message to conversation (atomic operation)
   */
  async addMessage(conversationId, messageData) {
    try {
      validator.validateWhatsappId(conversationId);
      const validatedMessageData = validator.validateMessageInput(messageData);

      logger.database('ADD_MESSAGE', this.modelName, { 
        conversationId,
        messageId: validatedMessageData.whatsappMessageId,
        direction: validatedMessageData.direction
      });

      // Use upsert to create conversation if it doesn't exist
      const update = {
        $push: { 
          messages: {
            $each: [validatedMessageData],
            $position: 0 // Add to beginning for better performance
          }
        },
        $set: { 
          lastUpdated: new Date() 
        }
      };

      const options = {
        new: true,
        upsert: true, // Create if doesn't exist
        runValidators: true,
        setDefaultsOnInsert: true
      };

      const updatedConversation = await Conversation.findOneAndUpdate(
        { conversationId },
        update,
        options
      );

      logger.success('ConversationService', `Message added to conversation`, {
        conversationId,
        messageId: validatedMessageData.whatsappMessageId,
        direction: validatedMessageData.direction,
        totalMessages: updatedConversation.messages.length
      });

      // Firestore sync hook (non-blocking)
      // Note: We sync the message only here. User metrics are synced from userService.
      if (constants.FIRESTORE.SYNC_ENABLED) {
        firestoreSyncService.syncMessageAddition(conversationId, validatedMessageData).catch(error => {
          logger.warn('ConversationService', 'Firestore message sync failed', { 
            conversationId,
            messageId: validatedMessageData.whatsappMessageId,
            error: error.message 
          });
        });
      }

      return updatedConversation;

    } catch (error) {
      logger.error('ConversationService', `Failed to add message: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get messages by direction (inbound, outbound_ai, outbound_agent)
   */
  async getMessagesByDirection(conversationId, direction, limit = constants.PAGINATION.DEFAULT_LIMIT) {
    try {
      validator.validateWhatsappId(conversationId);
      validator.validateMessageDirection(direction);
      
      const actualLimit = Math.min(limit, constants.PAGINATION.MAX_LIMIT);
      
      logger.database('GET_BY_DIRECTION', this.modelName, { 
        conversationId, 
        direction, 
        limit: actualLimit 
      });

      const conversation = await this.findConversation(conversationId);
      
      if (!conversation) {
        return [];
      }

      const messages = conversation.getMessagesByDirection(direction, actualLimit);

      logger.success('ConversationService', `Messages by direction retrieved`, {
        conversationId,
        direction,
        messagesFound: messages.length
      });

      return messages;

    } catch (error) {
      logger.error('ConversationService', `Failed to get messages by direction: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get media messages from conversation
   */
  async getMediaMessages(conversationId, limit = 10) {
    try {
      validator.validateWhatsappId(conversationId);
      
      logger.database('GET_MEDIA', this.modelName, { conversationId, limit });

      const conversation = await this.findConversation(conversationId);
      
      if (!conversation) {
        return [];
      }

      const mediaMessages = conversation.getMediaMessages(limit);

      logger.success('ConversationService', `Media messages retrieved`, {
        conversationId,
        mediaMessagesFound: mediaMessages.length
      });

      return mediaMessages;

    } catch (error) {
      logger.error('ConversationService', `Failed to get media messages: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Archive old messages in a conversation
   */
  async archiveOldMessages(conversationId, keepRecent = 1000) {
    try {
      validator.validateWhatsappId(conversationId);
      
      logger.database('ARCHIVE', this.modelName, { conversationId, keepRecent });

      const conversation = await this.findConversation(conversationId);
      
      if (!conversation) {
        throw new Error(`Conversation with ID ${conversationId} not found`);
      }

      if (conversation.messages.length <= keepRecent) {
        logger.info('ConversationService', `No archiving needed`, { 
          conversationId,
          currentMessages: conversation.messages.length,
          keepRecent
        });
        return conversation;
      }

      const archivedConversation = await conversation.archiveOldMessages(keepRecent);

      logger.success('ConversationService', `Old messages archived`, {
        conversationId,
        messagesRemoved: conversation.messages.length - archivedConversation.messages.length,
        messagesKept: archivedConversation.messages.length
      });

      return archivedConversation;

    } catch (error) {
      logger.error('ConversationService', `Failed to archive old messages: ${error.message}`, error);
      throw error;
    }
  }
}

// Create singleton instance
const conversationService = new ConversationService();

module.exports = conversationService;