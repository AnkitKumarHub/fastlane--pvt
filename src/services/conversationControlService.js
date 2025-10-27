/**
 * Conversation Control Service
 * Manages conversation state transitions between AI and Human modes
 */

const userService = require('./userService');
const firestoreService = require('./firestoreService');
const logger = require('../utils/logger');
const validator = require('../utils/validators');
const constants = require('../utils/constants');

class ConversationControlService {
  
  /**
   * Takeover conversation - Switch to HUMAN mode
   */
  async takeover(phoneNumber, lmId, lmName) {
    try {
      // Validate inputs
      validator.validateWhatsappId(phoneNumber);
      
      if (!lmId || !lmId.trim()) {
        throw new Error('LM ID is required');
      }
      
      if (!lmName || !lmName.trim()) {
        throw new Error('LM Name is required');
      }

      logger.info('ConversationControl', 'Taking over conversation', {
        phoneNumber,
        lmId,
        lmName
      });

      // Check if user exists, create if not
      let user = await userService.findUserByWhatsappId(phoneNumber);
      
      if (!user) {
        logger.info('ConversationControl', 'User not found, creating new user', { phoneNumber });
        user = await userService.findOrCreateUser({
          whatsappId: phoneNumber,
          phoneNumber: phoneNumber,
          assignedToLm: false // Default value for new users
        });
      }

      // Check if already in HUMAN mode
      if (user.conversationStatus === constants.CONVERSATION_STATUS.HUMAN) {
        logger.warn('ConversationControl', 'Conversation already in HUMAN mode', {
          phoneNumber,
          currentLm: user.assignedLmId,
          requestingLm: lmId
        });
        
        // Allow takeover even if already in HUMAN mode (for LM reassignment)
      }

      // Prepare update data
      const updateData = {
        conversationStatus: constants.CONVERSATION_STATUS.HUMAN,
        assignedLmId: lmId,
        lastTakeover: {
          timestamp: new Date(),
          lmId: lmId,
          lmName: lmName
        }
      };

      // Update MongoDB
      const updatedUser = await userService.updateConversationControl(
        phoneNumber,
        updateData
      );

      // Sync to Firestore (non-blocking)
      if (constants.FIRESTORE.SYNC_ENABLED) {
        firestoreService.saveUser(phoneNumber, {
          conversationStatus: constants.CONVERSATION_STATUS.HUMAN,
          assignedLmId: lmId,
          lastTakeover: updateData.lastTakeover,
          updatedAt: new Date()
        }).catch(error => {
          logger.warn('ConversationControl', 'Firestore sync failed for takeover', {
            phoneNumber,
            error: error.message
          });
        });
      }

      logger.success('ConversationControl', 'Conversation taken over successfully', {
        phoneNumber,
        lmId,
        conversationStatus: updatedUser.conversationStatus
      });

      return {
        success: true,
        phoneNumber: updatedUser.phoneNumber || phoneNumber,
        conversationStatus: updatedUser.conversationStatus,
        assignedLmId: updatedUser.assignedLmId,
        lastTakeover: updatedUser.lastTakeover
      };

    } catch (error) {
      logger.error('ConversationControl', `Takeover failed: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Release conversation - Switch to AI mode
   */
  async release(phoneNumber, lmId, lmName) {
    try {
      // Validate inputs
      validator.validateWhatsappId(phoneNumber);
      
      if (!lmId || !lmId.trim()) {
        throw new Error('LM ID is required');
      }
      
      // if (!lmName || !lmName.trim()) {
      //   throw new Error('LM Name is required');
      // }

      logger.info('ConversationControl', 'Releasing conversation', {
        phoneNumber,
        lmId,
        lmName
      });

      // Find user
      const user = await userService.findUserByWhatsappId(phoneNumber);
      
      if (!user) {
        throw new Error(`User with phone number ${phoneNumber} not found`);
      }

      // Validate: Only the assigned LM can release
      if (user.assignedLmId && user.assignedLmId !== lmId) {
        logger.warn('ConversationControl', 'Unauthorized release attempt', {
          phoneNumber,
          assignedLm: user.assignedLmId,
          requestingLm: lmId
        });
        throw new Error('Only the assigned LM can release this conversation');
      }

      // Check if already in AI mode
      if (user.conversationStatus === constants.CONVERSATION_STATUS.AI) {
        logger.warn('ConversationControl', 'Conversation already in AI mode', {
          phoneNumber
        });
        
        // Return success anyway (idempotent operation)
        return {
          success: true,
          phoneNumber: user.phoneNumber || phoneNumber,
          conversationStatus: user.conversationStatus,
          assignedLmId: user.assignedLmId,
          lastRelease: user.lastRelease,
          message: 'Conversation already in AI mode'
        };
      }

      // Prepare update data (DO NOT clear assignedLmId - keep for historical reference)
      const updateData = {
        conversationStatus: constants.CONVERSATION_STATUS.AI,
        // assignedLmId remains unchanged for historical tracking
        lastRelease: {
          timestamp: new Date(),
          lmId: lmId,
          lmName: lmName
        }
      };

      // Update MongoDB
      const updatedUser = await userService.updateConversationControl(
        phoneNumber,
        updateData
      );

      // Sync to Firestore (non-blocking)
      if (constants.FIRESTORE.SYNC_ENABLED) {
        firestoreService.saveUser(phoneNumber, {
          conversationStatus: constants.CONVERSATION_STATUS.AI,
          lastRelease: updateData.lastRelease,
          updatedAt: new Date()
        }).catch(error => {
          logger.warn('ConversationControl', 'Firestore sync failed for release', {
            phoneNumber,
            error: error.message
          });
        });
      }

      logger.success('ConversationControl', 'Conversation released successfully', {
        phoneNumber,
        lmId,
        conversationStatus: updatedUser.conversationStatus
      });

      return {
        success: true,
        phoneNumber: updatedUser.phoneNumber || phoneNumber,
        conversationStatus: updatedUser.conversationStatus,
        assignedLmId: updatedUser.assignedLmId, // Still shows last assigned LM
        lastRelease: updatedUser.lastRelease
      };

    } catch (error) {
      logger.error('ConversationControl', `Release failed: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get conversation status
   */
  async getStatus(phoneNumber) {
    try {
      validator.validateWhatsappId(phoneNumber);

      const status = await userService.getConversationStatus(phoneNumber);
      
      if (!status) {
        throw new Error(`User with phone number ${phoneNumber} not found`);
      }

      return status;

    } catch (error) {
      logger.error('ConversationControl', `Get status failed: ${error.message}`, error);
      throw error;
    }
  }
}

// Create singleton instance
const conversationControlService = new ConversationControlService();

module.exports = conversationControlService;
