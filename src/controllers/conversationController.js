/**
 * Conversation Controller
 * Handles HTTP requests for conversation control operations
 */

const conversationControlService = require('../services/conversationControlService');
const databaseService = require('../services/databaseService');
const whatsappService = require('../services/whatsappService');
const aiService = require('../services/aiService');
const userService = require('../services/userService');
const validator = require('../utils/validators');
const constants = require('../utils/constants');
const logger = require('../utils/logger');

class ConversationController {
  
  /**
   * Takeover conversation
   * POST /api/conversation/takeover
   */
  static async takeover(req, res) {
    try {
      const { phoneNumber, lmId, lmName } = req.body;

      // Validate request body
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      if (!lmId) {
        return res.status(400).json({
          success: false,
          error: 'LM ID is required'
        });
      }

      // if (!lmName) {
      //   return res.status(400).json({
      //     success: false,
      //     error: 'LM Name is required'
      //   });
      // }

      // logger.api('POST', '/api/conversation/takeover', { phoneNumber, lmId });

      // Call service
      const result = await conversationControlService.takeover(
        phoneNumber,
        lmId,
        lmName
      );

      logger.success('ConversationController', 'Takeover successful', {
        phoneNumber,
        lmId
      });

      return res.status(200).json({
        success: true,
        message: 'Conversation taken over successfully',
        data: result
      });

    } catch (error) {
      logger.error('ConversationController', `Takeover failed: ${error.message}`, error);
      
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to take over conversation'
      });
    }
  }

  /**
   * Release conversation
   * POST /api/conversation/release
   */
  static async release(req, res) {
    try {
      const { phoneNumber, lmId, lmName } = req.body;

      // Validate request body
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      if (!lmId) {
        return res.status(400).json({
          success: false,
          error: 'LM ID is required'
        });
      }

      // if (!lmName) {
      //   return res.status(400).json({
      //     success: false,
      //     error: 'LM Name is required'
      //   });
      // }

      logger.api('POST', '/api/conversation/release', { phoneNumber, lmId });

      // Call service
      const result = await conversationControlService.release(
        phoneNumber,
        lmId,
        lmName
      );

      logger.success('ConversationController', 'Release successful', {
        phoneNumber,
        lmId
      });

      return res.status(200).json({
        success: true,
        message: 'Conversation released to AI successfully',
        data: result
      });

    } catch (error) {
      logger.error('ConversationController', `Release failed: ${error.message}`, error);
      
      // Check if it's an authorization error
      if (error.message.includes('Only the assigned LM')) {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to release conversation'
      });
    }
  }

  /**
   * Get conversation status
   * GET /api/conversation/status/:phoneNumber
   */
  static async getStatus(req, res) {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      logger.api('GET', `/api/conversation/status/${phoneNumber}`);

      const status = await conversationControlService.getStatus(phoneNumber);

      return res.status(200).json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('ConversationController', `Get status failed: ${error.message}`, error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get conversation status'
      });
    }
  }

  /**
   * Send LM message to user
   * POST /api/conversation/lm/send
   */
  static async sendLmMessage(req, res) {
    const startTime = Date.now();
    
    try {
      const { phoneNumber, lmId, message, clientMessageId } = req.body;

      // logger.api('POST', '/api/conversation/lm/send', { 
      //   phoneNumber, 
      //   lmId, 
      //   clientMessageId 
      // });

      // Step 1: Validate request body
      let validatedData;
      try {
        validatedData = validator.validateLmMessage(req.body);
      } catch (validationError) {
        logger.warn('ConversationController', `LM message validation failed: ${validationError.message}`);
        return res.status(400).json({
          success: false,
          error: validationError.message
        });
      }

      // Step 2: Check if user exists
      const user = await userService.findUserByWhatsappId(validatedData.phoneNumber);
      if (!user) {
        logger.warn('ConversationController', 'User not found for LM message', { 
          phoneNumber: validatedData.phoneNumber 
        });
        return res.status(400).json({
          success: false,
          error: `User with phone number ${validatedData.phoneNumber} not found`
        });
      }

      // Step 3: Authorization check - ensure LM is assigned to this user
      if (user.assignedLmId !== validatedData.lmId) {
        logger.warn('ConversationController', 'Unauthorized LM send attempt', {
          phoneNumber: validatedData.phoneNumber,
          requestedLmId: validatedData.lmId,
          assignedLmId: user.assignedLmId
        });
        return res.status(403).json({
          success: false,
          error: `LM ${validatedData.lmId} is not assigned to this user. Assigned LM: ${user.assignedLmId || 'None'}`
        });
      }

      // Step 4: Ensure conversation is in HUMAN mode
      if (user.conversationStatus !== constants.CONVERSATION_STATUS.HUMAN) {
        logger.warn('ConversationController', 'LM send attempt in non-HUMAN mode', {
          phoneNumber: validatedData.phoneNumber,
          currentStatus: user.conversationStatus
        });
        return res.status(400).json({
          success: false,
          error: `Conversation is in ${user.conversationStatus} mode. LM can only send messages in HUMAN mode.`
        });
      }

      // Step 5: Send WhatsApp message
      let whatsappResponse;
      try {
        whatsappResponse = await whatsappService.sendMessage(
          validatedData.phoneNumber,
          validatedData.message
        );
      } catch (whatsappError) {
        logger.error('ConversationController', `WhatsApp send failed: ${whatsappError.message}`, whatsappError);
        return res.status(503).json({
          success: false,
          error: 'Failed to send WhatsApp message',
          details: whatsappError.message,
          retryable: true
        });
      }

      // Step 6: Async AI call (fire-and-forget for performance)
      // This keeps AI context updated without blocking the response
      aiService.sendMessageToAI(
        validatedData.message,
        validatedData.phoneNumber,
        constants.CONVERSATION_STATUS.HUMAN
      ).catch(aiError => {
        logger.warn('ConversationController', 'Async AI context update failed (non-critical)', {
          phoneNumber: validatedData.phoneNumber,
          error: aiError.message
        });
        // Don't fail the request - AI context update is best-effort
      });

      // Step 7: Save to database with idempotency check
      // Extract and validate WhatsApp message ID
      const whatsappMessageId = whatsappResponse?.messages?.[0]?.id;
      
      if (!whatsappMessageId) {
        logger.error('ConversationController', 'No message ID in WhatsApp response', {
          phoneNumber: validatedData.phoneNumber,
          response: whatsappResponse
        });
        return res.status(500).json({
          success: false,
          error: 'WhatsApp message sent but no message ID received',
          details: 'Unable to track message in database'
        });
      }

      let dbResult;
      try {
        dbResult = await databaseService.processOutgoingLmMessage(
          validatedData.phoneNumber,
          {
            whatsappMessageId: whatsappMessageId,
            textContent: validatedData.message,
            timestamp: new Date()
          },
          validatedData.clientMessageId,
          validatedData.lmId
        );
      } catch (dbError) {
        logger.error('ConversationController', `Database save failed: ${dbError.message}`, dbError);
        // Message sent successfully but database failed
        return res.status(500).json({
          success: false,
          error: 'Message sent but failed to save to database',
          details: dbError.message,
          whatsappMessageId: whatsappMessageId
        });
      }

      // Check if duplicate was detected
      if (dbResult.isDuplicate) {
        logger.info('ConversationController', 'Duplicate message request handled', {
          phoneNumber: validatedData.phoneNumber,
          clientMessageId: validatedData.clientMessageId
        });
        return res.status(200).json({
          success: true,
          message: 'Duplicate message detected - no action taken',
          data: {
            isDuplicate: true,
            existingMessageId: dbResult.existingMessage?.whatsappMessageId,
            processingTimeMs: Date.now() - startTime
          }
        });
      }

      const totalTime = Date.now() - startTime;

      logger.success('ConversationController', 'LM message sent successfully', {
        phoneNumber: validatedData.phoneNumber,
        lmId: validatedData.lmId,
        whatsappMessageId: whatsappMessageId,
        clientMessageId: validatedData.clientMessageId,
        processingTimeMs: totalTime
      });

      // Step 8: Return success response
      return res.status(200).json({
        success: true,
        message: 'LM message sent successfully',
        data: {
          whatsappMessageId: whatsappMessageId,
          clientMessageId: validatedData.clientMessageId,
          timestamp: new Date().toISOString(),
          processingTimeMs: totalTime,
          isDuplicate: false
        }
      });

    } catch (error) {
      logger.error('ConversationController', `Send LM message failed: ${error.message}`, error);
      
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to send LM message',
        processingTimeMs: Date.now() - startTime
      });
    }
  }
}

module.exports = ConversationController;
