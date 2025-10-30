/**
 * User Controller
 * Handles user-related API endpoints for NOC synchronization
 */

const userService = require('../services/userService');
const logger = require('../utils/logger');

class UserController {

  /**
   * Update Lynn user status (for NOC sync)
   * PUT /api/user/lynn-status
   */
  static async updateLynnUserStatus(req, res) {
    try {
      const { whatsappId, lynnUserStatus } = req.body;

    //   logger.info('UserController', 'Update Lynn user status request', { 
    //     whatsappId, 
    //     lynnUserStatus 
    //   });

      // Validate required fields
      if (!whatsappId) {
        return res.status(400).json({
          success: false,
          error: 'whatsappId is required'
        });
      }

      if (!lynnUserStatus) {
        return res.status(400).json({
          success: false,
          error: 'lynnUserStatus is required'
        });
      }

      // Update user status
      const updatedUser = await userService.updateLynnUserStatus(whatsappId, lynnUserStatus);

    //   logger.success('UserController', 'Lynn user status updated successfully', {
    //     whatsappId,
    //     lynnUserStatus: updatedUser.lynnUserStatus
    //   });

      res.status(200).json({
        success: true,
        message: 'Lynn user status updated successfully',
        data: {
          whatsappId: updatedUser.whatsappId,
          lynnUserStatus: updatedUser.lynnUserStatus,
          updatedAt: updatedUser.updatedAt
        }
      });

    } catch (error) {
    //   logger.error('UserController', `Failed to update Lynn user status: ${error.message}`, error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  }

  /**
   * Update assigned to LM status (for NOC sync)
   * PUT /api/user/assigned-lm
   */
  static async updateAssignedToLm(req, res) {
    try {
      const { whatsappId, assignedToLm } = req.body;

    //   logger.info('UserController', 'Update assigned to LM request', { 
    //     whatsappId, 
    //     assignedToLm 
    //   });

      // Validate required fields
      if (!whatsappId) {
        return res.status(400).json({
          success: false,
          error: 'whatsappId is required'
        });
      }

      if (typeof assignedToLm !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'assignedToLm must be a boolean value'
        });
      }

      // Update assigned to LM status
      const updatedUser = await userService.updateAssignedToLm(whatsappId, assignedToLm);

    //   logger.success('UserController', 'Assigned to LM status updated successfully', {
    //     whatsappId,
    //     assignedToLm: updatedUser.assignedToLm
    //   });

      res.status(200).json({
        success: true,
        message: 'Assigned to LM status updated successfully',
        data: {
          whatsappId: updatedUser.whatsappId,
          assignedToLm: updatedUser.assignedToLm,
          updatedAt: updatedUser.updatedAt
        }
      });

    } catch (error) {
    //   logger.error('UserController', `Failed to update assigned to LM status: ${error.message}`, error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  }

  /**
   * Get user information
   * GET /api/user/:whatsappId
   */
  static async getUserInfo(req, res) {
    try {
      const { whatsappId } = req.params;

      logger.info('UserController', 'Get user info request', { whatsappId });

      if (!whatsappId) {
        return res.status(400).json({
          success: false,
          error: 'whatsappId is required'
        });
      }

      const user = await userService.findUserByWhatsappId(whatsappId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      logger.success('UserController', 'User info retrieved successfully', { whatsappId });

      res.status(200).json({
        success: true,
        data: {
          whatsappId: user.whatsappId,
          displayName: user.displayName,
          phoneNumber: user.phoneNumber,
          conversationStatus: user.conversationStatus,
          assignedLmId: user.assignedLmId,
          assignedToLm: user.assignedToLm,
          lynnUserStatus: user.lynnUserStatus,
          isActive: user.isActive,
          totalMessageCount: user.totalMessageCount,
          lastMessageUpdatedAt: user.lastMessageUpdatedAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });

    } catch (error) {
      logger.error('UserController', `Failed to get user info: ${error.message}`, error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  }
}

module.exports = UserController;