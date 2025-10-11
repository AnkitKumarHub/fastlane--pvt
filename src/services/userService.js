/**
 * User Service
 * Handles all user-related database operations with optimized queries
 */

const { User } = require('../models');
const logger = require('../utils/logger');
const validator = require('../utils/validators');
const constants = require('../utils/constants');
const firestoreSyncService = require('./firestoreSyncService'); // Firestore sync

class UserService {
  constructor() {
    this.modelName = 'User';
  }

  /**
   * Create a new user with validation
   */
  async createUser(userData) {
    try {
      // Validate and sanitize input
      const validatedData = validator.validateUserInput(userData);
      
      logger.database('CREATE', this.modelName, { whatsappId: validatedData.whatsappId });

      // Check if user already exists
      const existingUser = await User.findByWhatsappId(validatedData.whatsappId);
      if (existingUser) {
        throw new Error(`User with WhatsApp ID ${validatedData.whatsappId} already exists`);
      }

      // Create new user
      const user = new User(validatedData);
      const savedUser = await user.save();

      logger.success('UserService', `User created successfully`, { 
        whatsappId: savedUser.whatsappId,
        userId: savedUser._id 
      });

      // Firestore sync hook (non-blocking)
      if (constants.FIRESTORE.SYNC_ENABLED) {
        firestoreSyncService.syncUserCreation(savedUser).catch(error => {
          logger.warn('UserService', 'Firestore user creation sync failed', { 
            whatsappId: savedUser.whatsappId, 
            error: error.message 
          });
        });
      }

      return savedUser;

    } catch (error) {
      logger.error('UserService', `Failed to create user: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Find user by WhatsApp ID
   */
  async findUserByWhatsappId(whatsappId) {
    try {
      validator.validateWhatsappId(whatsappId);
      
      logger.database('FIND', this.modelName, { whatsappId });

      const user = await User.findByWhatsappId(whatsappId);
      
      if (!user) {
        logger.warn('UserService', `User not found`, { whatsappId });
        return null;
      }

      logger.debug('UserService', `User found`, { 
        whatsappId,
        userId: user._id,
        status: user.conversationStatus 
      });

      return user;

    } catch (error) {
      logger.error('UserService', `Failed to find user: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Find or create user (upsert operation)
   */
  async findOrCreateUser(userData) {
    try {
      const existingUser = await this.findUserByWhatsappId(userData.whatsappId);
      
      if (existingUser) {
        logger.debug('UserService', `User exists, returning existing user`, { 
          whatsappId: userData.whatsappId 
        });
        return existingUser;
      }

      logger.info('UserService', `User not found, creating new user`, { 
        whatsappId: userData.whatsappId 
      });
      return await this.createUser(userData);

    } catch (error) {
      logger.error('UserService', `Failed to find or create user: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update user metrics for inbound messages (atomic operation)
   */
  async updateUserMetrics(whatsappId, messageText, increment = 1) {
    try {
      validator.validateWhatsappId(whatsappId);
      validator.validateTextContent(messageText);

      logger.database('UPDATE_METRICS', this.modelName, { 
        whatsappId, 
        type: 'user',
        increment 
      });

      const user = await User.findOne({ whatsappId });
      if (!user) {
        throw new Error(`User with WhatsApp ID ${whatsappId} not found`);
      }

      const updatedUser = await user.updateUserMetrics(messageText, increment);

      logger.success('UserService', `User metrics updated`, {
        whatsappId,
        newUserMessageCount: updatedUser.userMetrics.messageCount,
        newTotalCount: updatedUser.totalMessageCount
      });

      // Firestore sync hook (non-blocking)
      if (constants.FIRESTORE.SYNC_ENABLED) {
        firestoreSyncService.syncUserMetricsUpdate(updatedUser, 'user').catch(error => {
          logger.warn('UserService', 'Firestore user metrics sync failed', { 
            whatsappId, 
            error: error.message 
          });
        });
      }

      return updatedUser;

    } catch (error) {
      logger.error('UserService', `Failed to update user metrics: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update AI metrics for outbound AI messages (atomic operation)
   */
  async updateAiMetrics(whatsappId, messageText, increment = 1) {
    try {
      validator.validateWhatsappId(whatsappId);
      validator.validateTextContent(messageText);

      logger.database('UPDATE_METRICS', this.modelName, { 
        whatsappId, 
        type: 'ai',
        increment 
      });

      const user = await User.findOne({ whatsappId });
      if (!user) {
        throw new Error(`User with WhatsApp ID ${whatsappId} not found`);
      }

      const updatedUser = await user.updateAiMetrics(messageText, increment);

      logger.success('UserService', `AI metrics updated`, {
        whatsappId,
        newAiMessageCount: updatedUser.aiMetrics.messageCount,
        newTotalCount: updatedUser.totalMessageCount
      });

      // Firestore sync hook (non-blocking)
      if (constants.FIRESTORE.SYNC_ENABLED) {
        firestoreSyncService.syncUserMetricsUpdate(updatedUser, 'ai').catch(error => {
          logger.warn('UserService', 'Firestore AI metrics sync failed', { 
            whatsappId, 
            error: error.message 
          });
        });
      }

      return updatedUser;

    } catch (error) {
      logger.error('UserService', `Failed to update AI metrics: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update conversation status
   */
  async updateConversationStatus(whatsappId, newStatus) {
    try {
      validator.validateWhatsappId(whatsappId);
      validator.validateConversationStatus(newStatus);

      logger.database('UPDATE_STATUS', this.modelName, { whatsappId, newStatus });

      const user = await User.findOne({ whatsappId });
      if (!user) {
        throw new Error(`User with WhatsApp ID ${whatsappId} not found`);
      }

      const updatedUser = await user.updateStatus(newStatus);

      logger.success('UserService', `Conversation status updated`, {
        whatsappId,
        oldStatus: user.conversationStatus,
        newStatus: updatedUser.conversationStatus
      });

      // Firestore sync hook (non-blocking)
      if (constants.FIRESTORE.SYNC_ENABLED) {
        firestoreSyncService.syncUserStatusUpdate(updatedUser).catch(error => {
          logger.warn('UserService', 'Firestore status update sync failed', { 
            whatsappId, 
            error: error.message 
          });
        });
      }

      return updatedUser;

    } catch (error) {
      logger.error('UserService', `Failed to update conversation status: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get active users with pagination
   */
  async getActiveUsers(limit = constants.PAGINATION.DEFAULT_LIMIT, offset = 0) {
    try {
      logger.database('FIND_ACTIVE', this.modelName, { limit, offset });

      const users = await User.find({ isActive: true })
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(Math.min(limit, constants.PAGINATION.MAX_LIMIT))
        .select('whatsappId displayName conversationStatus totalMessageCount updatedAt')
        .lean(); // Use lean() for better performance when not modifying

      logger.success('UserService', `Active users retrieved`, { 
        count: users.length,
        limit,
        offset 
      });

      return users;

    } catch (error) {
      logger.error('UserService', `Failed to get active users: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get users by conversation status
   */
  async getUsersByStatus(status, limit = constants.PAGINATION.DEFAULT_LIMIT) {
    try {
      validator.validateConversationStatus(status);
      
      logger.database('FIND_BY_STATUS', this.modelName, { status, limit });

      const users = await User.findByStatus(status, limit);

      logger.success('UserService', `Users by status retrieved`, { 
        status,
        count: users.length 
      });

      return users;

    } catch (error) {
      logger.error('UserService', `Failed to get users by status: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(whatsappId) {
    try {
      validator.validateWhatsappId(whatsappId);

      logger.database('DEACTIVATE', this.modelName, { whatsappId });

      const updatedUser = await User.findOneAndUpdate(
        { whatsappId },
        { 
          $set: { 
            isActive: false,
            updatedAt: new Date()
          }
        },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        throw new Error(`User with WhatsApp ID ${whatsappId} not found`);
      }

      logger.success('UserService', `User deactivated`, { whatsappId });

      // Firestore sync hook (non-blocking)
      if (constants.FIRESTORE.SYNC_ENABLED) {
        firestoreSyncService.syncUserDeactivation(updatedUser).catch(error => {
          logger.warn('UserService', 'Firestore deactivation sync failed', { 
            whatsappId, 
            error: error.message 
          });
        });
      }

      return updatedUser;

    } catch (error) {
      logger.error('UserService', `Failed to deactivate user: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Reactivate user
   */
  async reactivateUser(whatsappId) {
    try {
      validator.validateWhatsappId(whatsappId);

      logger.database('REACTIVATE', this.modelName, { whatsappId });

      const updatedUser = await User.findOneAndUpdate(
        { whatsappId },
        { 
          $set: { 
            isActive: true,
            updatedAt: new Date()
          }
        },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        throw new Error(`User with WhatsApp ID ${whatsappId} not found`);
      }

      logger.success('UserService', `User reactivated`, { whatsappId });

      // Firestore sync hook (non-blocking)
      if (constants.FIRESTORE.SYNC_ENABLED) {
        firestoreSyncService.syncUserReactivation(updatedUser).catch(error => {
          logger.warn('UserService', 'Firestore reactivation sync failed', { 
            whatsappId, 
            error: error.message 
          });
        });
      }

      return updatedUser;

    } catch (error) {
      logger.error('UserService', `Failed to reactivate user: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update user profile information
   */
  async updateUserProfile(whatsappId, profileData) {
    try {
      validator.validateWhatsappId(whatsappId);
      
      const allowedFields = ['displayName', 'phoneNumber'];
      const updateData = {};
      
      // Only update allowed fields
      allowedFields.forEach(field => {
        if (profileData[field] !== undefined) {
          updateData[field] = validator.sanitizeString(profileData[field], 100);
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw new Error('No valid fields to update');
      }

      updateData.updatedAt = new Date();

      logger.database('UPDATE_PROFILE', this.modelName, { whatsappId, fields: Object.keys(updateData) });

      const updatedUser = await User.findOneAndUpdate(
        { whatsappId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        throw new Error(`User with WhatsApp ID ${whatsappId} not found`);
      }

      logger.success('UserService', `User profile updated`, { 
        whatsappId,
        updatedFields: Object.keys(updateData)
      });

      // Firestore sync hook (non-blocking)
      if (constants.FIRESTORE.SYNC_ENABLED) {
        firestoreSyncService.syncUserProfileUpdate(updatedUser, Object.keys(updateData)).catch(error => {
          logger.warn('UserService', 'Firestore profile update sync failed', { 
            whatsappId, 
            error: error.message 
          });
        });
      }

      return updatedUser;

    } catch (error) {
      logger.error('UserService', `Failed to update user profile: ${error.message}`, error);
      throw error;
    }
  }
}

// Create singleton instance
const userService = new UserService();

module.exports = userService;