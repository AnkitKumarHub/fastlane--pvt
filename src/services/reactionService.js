/**
 * Reaction Service
 * Handles WhatsApp emoji reaction processing and updates
 */

const databaseService = require('./databaseService');
const firestoreMessageService = require('./firebase/firestoreMessageService');
const logger = require('../utils/logger');

class ReactionService {
  
  /**
   * Process incoming reaction from WhatsApp webhook
   */
  static async processReaction(reactionData) {
    try {
      console.log('🎯 === REACTION PROCESSING STARTED ===');

      const {
        from: reactorWhatsappId,
        reaction: reactionInfo,
        timestamp: reactionTimestamp
      } = reactionData;

      if (!reactionInfo || !reactionInfo.message_id) {
        console.log('⚠️ Invalid reaction data - missing message_id');
        return null;
      }

      const reactedMessageId = reactionInfo.message_id;
      const emoji = reactionInfo.emoji || '';
      const timestamp = new Date(parseInt(reactionTimestamp) * 1000);

      // Find the conversation and message that was reacted to
      const messageLocation = await this.findMessageByWhatsappId(reactedMessageId);
      
      if (!messageLocation) {
        console.log('❌ Message not found for reaction:', reactedMessageId);
        return null;
      }

      // Update the message with reaction
      const result = await this.updateMessageReaction(
        messageLocation.conversationId,
        messageLocation.messageIndex,
        {
          emoji,
          timestamp,
          reactedBy: reactorWhatsappId
        }
      );

      console.log('🎯 === REACTION PROCESSING COMPLETE ===');
      return result;

    } catch (error) {
      console.error('❌ === REACTION PROCESSING ERROR ===');
      console.error('Error processing reaction:', error.message);
      console.error('Error stack:', error.stack);
      console.error('❌ === END REACTION PROCESSING ERROR ===');
      return null;
    }
  }

  /**
   * Find message by WhatsApp message ID across all conversations
   */
  static async findMessageByWhatsappId(whatsappMessageId) {
    try {
      // Use database service to find message
      const result = await databaseService.findMessageByWhatsappId(whatsappMessageId);
      
      if (result) {
        return result;
      }

      return null;

    } catch (error) {
      console.error('❌ Error finding message:', error.message);
      return null;
    }
  }

  /**
   * Update message with reaction data
   */
  static async updateMessageReaction(conversationId, messageIndex, reactionData) {
    try {
      // Prepare reaction update
      const reactionUpdate = reactionData.emoji ? {
        emoji: reactionData.emoji,
        timestamp: reactionData.timestamp,
        reactedBy: reactionData.reactedBy
      } : null; // null = remove reaction

      // Update in MongoDB
      const mongoResult = await databaseService.updateMessageReaction(
        conversationId,
        messageIndex,
        reactionUpdate
      );

      if (!mongoResult) {
        console.log('❌ Failed to update message in MongoDB');
        return null;
      }

      // Sync to Firestore
      try {
        const firestoreResult = await this.syncReactionToFirestore(
          conversationId,
          mongoResult.whatsappMessageId,
          reactionUpdate
        );
        
        if (!firestoreResult) {
          console.warn('⚠️ Firestore sync was skipped or failed');
        }
      } catch (firestoreError) {
        console.warn('⚠️ Firestore sync failed (non-blocking):', firestoreError.message);
      }

      return {
        success: true,
        conversationId,
        messageIndex,
        reaction: reactionUpdate
      };

    } catch (error) {
      console.error('❌ Error updating message reaction:', error.message);
      return null;
    }
  }

  /**
   * Sync reaction update to Firestore
   */
  static async syncReactionToFirestore(conversationId, whatsappMessageId, reactionData) {
    try {
      if (!firestoreMessageService.isReady()) {
        return null;
      }

      // Use Firestore service to update reaction
      const result = await firestoreMessageService.updateMessageReaction(
        conversationId,
        whatsappMessageId,
        reactionData
      );

      if (result) {
        console.log('✅ Firestore reaction synced successfully');
      }

      return result;

    } catch (error) {
      console.warn('⚠️ Firestore sync failed (non-blocking):', error.message);
      return null;
    }
  }

  /**
   * Remove reaction from message
   */
  static async removeReaction(conversationId, messageIndex) {
    try {
      return await this.updateMessageReaction(conversationId, messageIndex, { emoji: '' });

    } catch (error) {
      console.error('❌ Error removing reaction:', error.message);
      return null;
    }
  }

  /**
   * Get reaction statistics (future use)
   */
  static async getReactionStats(conversationId) {
    try {
      // This can be implemented later for analytics
      return { message: 'Reaction stats not implemented yet' };

    } catch (error) {
      console.error('❌ Error getting reaction stats:', error.message);
      return null;
    }
  }
}

module.exports = ReactionService;