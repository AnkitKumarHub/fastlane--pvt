/**
 * User Model
 * Mongoose schema for whatsappUsers collection - stores current state and metrics
 */

const mongoose = require('mongoose');
const constants = require('../utils/constants');

// User Metrics Schema (for both user and AI metrics)
const metricsSchema = new mongoose.Schema({
  lastMessage: {
    type: String,
    maxlength: constants.WHATSAPP_LIMITS.MESSAGE_LENGTH
  },
  lastMessageTimestamp: {
    type: Date,
    default: Date.now
  },
  messageCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

// Main User Schema
const userSchema = new mongoose.Schema({
  whatsappId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    minlength: constants.VALIDATION.WHATSAPP_ID.MIN_LENGTH,
    maxlength: constants.VALIDATION.WHATSAPP_ID.MAX_LENGTH,
    match: constants.VALIDATION.WHATSAPP_ID.PATTERN
  },
  assignedToLm:{
    type: Boolean,
    default: false
  },

  displayName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  phoneNumber: {
    type: String,
    trim: true,
    match: constants.VALIDATION.PHONE_NUMBER.PATTERN
  },
  
  conversationStatus: {
    type: String,
    enum: Object.values(constants.CONVERSATION_STATUS),
    default: constants.CONVERSATION_STATUS.AI,
    index: true
  },
  
  assignedLmId: {
    type: String,
    default: null,
    trim: true,
    index: true
  },
  
  lastTakeover: {
    timestamp: {
      type: Date,
      default: null
    },
    lmId: {
      type: String,
      trim: true
    },
    lmName: {
      type: String,
      trim: true
    }
  },
  
  lastRelease: {
    timestamp: {
      type: Date,
      default: null
    },
    lmId: {
      type: String,
      trim: true
    },
    lmName: {
      type: String,
      trim: true
    }
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  totalMessageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // User message metrics (renamed from inboundMetrics)
  userMetrics: {
    type: metricsSchema,
    default: () => ({
      messageCount: 0,
      lastMessage: '',
      lastMessageTimestamp: new Date()
    })
  },
  
  // AI message metrics
  aiMetrics: {
    type: metricsSchema,
    default: () => ({
      messageCount: 0,
      lastMessage: '',
      lastMessageTimestamp: new Date()
    })
  },
  
  // LM (Lifestyle Manager) message metrics
  lmMetrics: {
    type: metricsSchema,
    default: () => ({
      messageCount: 0,
      lastMessage: '',
      lastMessageTimestamp: new Date()
    })
  }
}, {
  timestamps: true,  // Adds createdAt and updatedAt automatically
  strict: false,     // Allows additional fields for flexibility
  collection: constants.DATABASE.COLLECTIONS.USERS
});

// Indexes for performance optimization
userSchema.index({ conversationStatus: 1, isActive: 1 });
userSchema.index({ conversationStatus: 1, assignedLmId: 1 });
userSchema.index({ updatedAt: -1 });
userSchema.index({ 'userMetrics.lastMessageTimestamp': -1 });
userSchema.index({ 'aiMetrics.lastMessageTimestamp': -1 });

// Pre-save middleware for data validation and optimization
userSchema.pre('save', function(next) {
  // Ensure total message count is sum of user, AI, and LM messages
  this.totalMessageCount = this.userMetrics.messageCount + 
                           this.aiMetrics.messageCount + 
                           this.lmMetrics.messageCount;
  
  // Update the main updatedAt timestamp
  this.updatedAt = new Date();
  
  next();
});

// Static methods for common queries
userSchema.statics = {
  /**
   * Find user by WhatsApp ID
   */
  findByWhatsappId(whatsappId) {
    return this.findOne({ whatsappId }).exec();
  },

  /**
   * Find active users
   */
  findActiveUsers(limit = 50) {
    return this.find({ isActive: true })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .exec();
  },

  /**
   * Find users by conversation status
   */
  findByStatus(status, limit = 50) {
    return this.find({ conversationStatus: status, isActive: true })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .exec();
  },

  /**
   * Get user statistics
   */
  async getUserStats() {
    const stats = await this.aggregate([
      {
        $group: {
          _id: '$conversationStatus',
          count: { $sum: 1 },
          totalMessages: { $sum: '$totalMessageCount' },
          avgMessages: { $avg: '$totalMessageCount' }
        }
      }
    ]);
    
    return stats;
  }
};

// Instance methods
userSchema.methods = {
  /**
   * Update user message metrics atomically
   */
  async updateUserMetrics(lastMessage, increment = 1) {
    const update = {
      $inc: { 
        'userMetrics.messageCount': increment,
        'totalMessageCount': increment
      },
      $set: {
        'userMetrics.lastMessage': lastMessage,
        'userMetrics.lastMessageTimestamp': new Date(),
        'updatedAt': new Date()
      }
    };

    return await this.constructor.findByIdAndUpdate(this._id, update, { 
      new: true, 
      runValidators: true 
    });
  },

  /**
   * Update AI message metrics atomically
   */
  async updateAiMetrics(lastMessage, increment = 1) {
    const update = {
      $inc: { 
        'aiMetrics.messageCount': increment,
        'totalMessageCount': increment
      },
      $set: {
        'aiMetrics.lastMessage': lastMessage,
        'aiMetrics.lastMessageTimestamp': new Date(),
        'updatedAt': new Date()
      }
    };

    return await this.constructor.findByIdAndUpdate(this._id, update, { 
      new: true, 
      runValidators: true 
    });
  },

  /**
   * Update LM message metrics atomically
   */
  async updateLmMetrics(lastMessage, increment = 1) {
    const update = {
      $inc: { 
        'lmMetrics.messageCount': increment,
        'totalMessageCount': increment
      },
      $set: {
        'lmMetrics.lastMessage': lastMessage,
        'lmMetrics.lastMessageTimestamp': new Date(),
        'updatedAt': new Date()
      }
    };

    return await this.constructor.findByIdAndUpdate(this._id, update, { 
      new: true, 
      runValidators: true 
    });
  },

  /**
   * Update conversation status atomically
   */
  async updateStatus(newStatus) {
    const update = {
      $set: {
        conversationStatus: newStatus,
        updatedAt: new Date()
      }
    };

    return await this.constructor.findByIdAndUpdate(this._id, update, { 
      new: true, 
      runValidators: true 
    });
  },

};

// Virtual for last activity check
userSchema.virtual('isRecentlyActive').get(function() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return this.updatedAt > oneHourAgo;
});

// Export the model
module.exports = mongoose.model('User', userSchema);