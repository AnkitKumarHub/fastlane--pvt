/**
 * Conversation Service (Streamlined)
 * Handles essential conversation-related database operations
 */

const { Conversation } = require('../models');
const logger = require('../utils/logger');
const validator = require('../utils/validators');
const constants = require('../utils/constants');

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

      // Note: Firestore sync happens at a higher level (databaseService)
      // This ensures complete data consistency with user metrics
      // See: databaseService.processIncomingMessage() and processOutgoingAIMessage()

      return updatedConversation;

    } catch (error) {
      logger.error('ConversationService', `Failed to add message: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Check if a message with given clientMessageId already exists (idempotency check)
   * Returns the existing message if found, null otherwise
   */
  async checkMessageIdempotency(conversationId, clientMessageId) {
    try {
      validator.validateWhatsappId(conversationId);
      validator.validateClientMessageId(clientMessageId);

      logger.database('CHECK_IDEMPOTENCY', this.modelName, { 
        conversationId,
        clientMessageId
      });

      const conversation = await Conversation.findOne({
        conversationId,
        'messages.clientMessageId': clientMessageId
      }).select('messages.$');

      if (conversation && conversation.messages.length > 0) {
        const existingMessage = conversation.messages[0];
        logger.warn('ConversationService', `Duplicate message detected`, {
          conversationId,
          clientMessageId,
          existingMessageId: existingMessage.whatsappMessageId
        });
        return existingMessage;
      }

      logger.debug('ConversationService', `No duplicate found`, {
        conversationId,
        clientMessageId
      });

      return null;

    } catch (error) {
      logger.error('ConversationService', `Failed to check message idempotency: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Add LM message to conversation (with idempotency support)
   */
  async addLmMessage(conversationId, messageData, clientMessageId, lmId, lmName = null) {
    try {
      validator.validateWhatsappId(conversationId);
      validator.validateClientMessageId(clientMessageId);

      // Prepare message data with LM-specific fields
      const lmMessageData = {
        ...messageData,
        direction: constants.MESSAGE_DIRECTION.OUTBOUND_LM,
        clientMessageId,
        assignedLmId: lmId,
        assignedLmName: lmName, // Include lmName in message data
        timestamp: new Date()
      };

      // Debug logging: Track data before validation
      logger.debug('ConversationService', 'LM message data before validation', {
        conversationId,
        lmName_beforeValidation: lmMessageData.assignedLmName,
        assignedLmId_beforeValidation: lmMessageData.assignedLmId,
        clientMessageId_beforeValidation: lmMessageData.clientMessageId
      });

      const validatedMessageData = validator.validateMessageInput(lmMessageData);

      // Debug logging: Track data after validation
      logger.debug('ConversationService', 'LM message data after validation', {
        conversationId,
        lmName_afterValidation: validatedMessageData.assignedLmName,
        assignedLmId_afterValidation: validatedMessageData.assignedLmId,
        clientMessageId_afterValidation: validatedMessageData.clientMessageId
      });

      logger.database('ADD_LM_MESSAGE', this.modelName, { 
        conversationId,
        messageId: validatedMessageData.whatsappMessageId,
        clientMessageId,
        lmId,
        lmName: lmName || 'Not provided'
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

      logger.success('ConversationService', `LM message added to conversation`, {
        conversationId,
        messageId: validatedMessageData.whatsappMessageId,
        clientMessageId,
        lmId,
        lmName: lmName || 'Not provided',
        totalMessages: updatedConversation.messages.length
      });

      return updatedConversation;

    } catch (error) {
      // Check for duplicate key error (unique index violation)
      if (error.code === 11000 && error.keyPattern && error.keyPattern['messages.clientMessageId']) {
        logger.warn('ConversationService', `Duplicate clientMessageId detected by database`, {
          conversationId,
          clientMessageId
        });
        throw new Error('DUPLICATE_MESSAGE');
      }

      logger.error('ConversationService', `Failed to add LM message: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get messages by direction (inbound, outbound_ai, outbound_lm)
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

  /**
   * Find message by WhatsApp message ID across all conversations
   */
  async findMessageByWhatsappId(whatsappMessageId) {
    try {
      logger.debug('ConversationService', 'Searching for message by WhatsApp ID', { whatsappMessageId });

      // Use MongoDB aggregation to search across all conversations
      const result = await Conversation.aggregate([
        { $match: { 'messages.whatsappMessageId': whatsappMessageId } },
        { $unwind: { path: '$messages', includeArrayIndex: 'messageIndex' } },
        { $match: { 'messages.whatsappMessageId': whatsappMessageId } },
        { 
          $project: {
            conversationId: 1,
            messageIndex: 1,
            message: '$messages'
          }
        },
        { $limit: 1 }
      ]);

      if (result.length === 0) {
        logger.debug('ConversationService', 'Message not found', { whatsappMessageId });
        return null;
      }

      const foundMessage = result[0];
      logger.debug('ConversationService', 'Message found', { 
        conversationId: foundMessage.conversationId,
        messageIndex: foundMessage.messageIndex,
        whatsappMessageId
      });

      return {
        conversationId: foundMessage.conversationId,
        messageIndex: foundMessage.messageIndex,
        message: foundMessage.message
      };

    } catch (error) {
      logger.error('ConversationService', `Failed to find message by WhatsApp ID: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update message reaction by conversation ID and message index
   */
  async updateMessageReaction(conversationId, messageIndex, reactionData) {
    try {
      validator.validateWhatsappId(conversationId);

      logger.debug('ConversationService', 'Updating message reaction', { 
        conversationId,
        messageIndex,
        hasReaction: !!reactionData
      });

      // Build update query - Fixed structure
      let updateOperation;
      
      if (reactionData && reactionData.emoji) {
        // Add or update reaction
        updateOperation = {
          $set: {
            [`messages.${messageIndex}.reaction`]: {
              emoji: reactionData.emoji,
              timestamp: reactionData.timestamp,
              reactedBy: reactionData.reactedBy
            },
            lastUpdated: new Date()
          }
        };
      } else {
        // Remove reaction
        updateOperation = {
          $unset: { [`messages.${messageIndex}.reaction`]: 1 },
          $set: { lastUpdated: new Date() }
        };
      }

      const conversation = await Conversation.findOneAndUpdate(
        { conversationId },
        updateOperation,
        { new: true }
      );

      if (!conversation) {
        throw new Error(`Conversation with ID ${conversationId} not found`);
      }

      const updatedMessage = conversation.messages[messageIndex];
      
      // Verify the reaction was actually updated
      if (reactionData && reactionData.emoji) {
        if (!updatedMessage.reaction || updatedMessage.reaction.emoji !== reactionData.emoji) {
          logger.error('ConversationService', 'Reaction update verification failed', {
            expected: reactionData.emoji,
            actual: updatedMessage.reaction?.emoji || '[NONE]'
          });
          throw new Error('Reaction update verification failed');
        }
      } else {
        if (updatedMessage.reaction) {
          logger.error('ConversationService', 'Reaction removal verification failed', {
            actualReaction: updatedMessage.reaction
          });
          throw new Error('Reaction removal verification failed');
        }
      }
      
      logger.success('ConversationService', 'Message reaction updated successfully', {
        conversationId,
        messageIndex,
        whatsappMessageId: updatedMessage.whatsappMessageId,
        reactionEmoji: updatedMessage.reaction?.emoji || '[REMOVED]'
      });

      return {
        conversation,
        message: updatedMessage,
        whatsappMessageId: updatedMessage.whatsappMessageId
      };

    } catch (error) {
      logger.error('ConversationService', `Failed to update message reaction: ${error.message}`, error);
      throw error;
    }
  }
}

// Create singleton instance
const conversationService = new ConversationService();

module.exports = conversationService;