/**
 * Conversation Model (Streamlined)
 * Mongoose schema for whatsappConversations collection - stores message history
 */

const mongoose = require('mongoose');
const constants = require('../utils/constants');

// Media Data Schema
const mediaDataSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: Object.values(constants.MEDIA_TYPES),
    required: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  mimeType: {
    type: String,
    trim: true
  },
  fileName: {
    type: String,
    trim: true
  },
  fileSize: {
    type: Number,
    min: 0,
    max: constants.FIREBASE.MAX_FILE_SIZE
  }
}, { _id: false });

// AI Audit Schema (only for outbound_ai messages)
const aiAuditSchema = new mongoose.Schema({
  checkpointId: {
    type: String,
    required: true,
    trim: true
  },
  processingTimeMs: {
    type: Number,
    required: true,
    min: 0,
    max: 60000 // Max 60 seconds processing time
  }
}, { _id: false });

// Message Schema
const messageSchema = new mongoose.Schema({
  whatsappMessageId: {
    type: String,
    required: true,
    trim: true,
    minlength: constants.VALIDATION.MESSAGE_ID.MIN_LENGTH,
    maxlength: constants.VALIDATION.MESSAGE_ID.MAX_LENGTH,
    match: constants.VALIDATION.MESSAGE_ID.PATTERN
  },
  
  direction: {
    type: String,
    enum: Object.values(constants.MESSAGE_DIRECTION),
    required: true,
    index: true
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  
  textContent: {
    type: String,
    trim: true,
    maxlength: constants.WHATSAPP_LIMITS.MESSAGE_LENGTH
  },
  
  mediaData: {
    type: mediaDataSchema,
    default: undefined
  },
  
  aiAudit: {
    type: aiAuditSchema,
    default: undefined
  }
}, { _id: false });

// Main Conversation Schema
const conversationSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    index: true,
    trim: true,
    minlength: constants.VALIDATION.WHATSAPP_ID.MIN_LENGTH,
    maxlength: constants.VALIDATION.WHATSAPP_ID.MAX_LENGTH
  },
  
  messages: {
    type: [messageSchema],
    default: [],
    validate: {
      validator: function(messages) {
        return messages.length <= 10000; // Limit messages per conversation
      },
      message: 'Conversation cannot have more than 10,000 messages'
    }
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  strict: false,    // Allows additional fields for flexibility
  collection: constants.DATABASE.COLLECTIONS.CONVERSATIONS
});

// Indexes for performance optimization
conversationSchema.index({ conversationId: 1, 'messages.timestamp': -1 });
conversationSchema.index({ 'messages.whatsappMessageId': 1 });
conversationSchema.index({ 'messages.direction': 1, 'messages.timestamp': -1 });
conversationSchema.index({ createdAt: -1 });

// Pre-save middleware
conversationSchema.pre('save', function(next) {
  // Update lastUpdated timestamp
  this.lastUpdated = new Date();
  
  // Sort messages by timestamp (newest first for better performance)
  if (this.messages && this.messages.length > 1) {
    this.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
  
  next();
});

// Static methods for common queries
conversationSchema.statics = {
  /**
   * Find conversation by conversation ID
   */
  findByConversationId(conversationId) {
    return this.findOne({ conversationId }).exec();
  }
};

// Instance methods
conversationSchema.methods = {
  /**
   * Get recent messages (paginated)
   */
  getRecentMessages(limit = 20, offset = 0) {
    const messages = this.messages
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(offset, offset + limit);
    
    return messages;
  },

  /**
   * Get messages by direction
   */
  getMessagesByDirection(direction, limit = 20) {
    return this.messages
      .filter(msg => msg.direction === direction)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  },

  /**
   * Get messages with media
   */
  getMediaMessages(limit = 10) {
    return this.messages
      .filter(msg => msg.mediaData)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  },

  /**
   * Archive old messages (keep only recent N messages)
   */
  async archiveOldMessages(keepRecent = 1000) {
    if (this.messages.length <= keepRecent) {
      return this;
    }

    const sortedMessages = this.messages
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, keepRecent);

    const update = {
      $set: { 
        messages: sortedMessages,
        lastUpdated: new Date() 
      }
    };

    return await this.constructor.findByIdAndUpdate(this._id, update, { 
      new: true 
    });
  }
};

// Virtual for message count
conversationSchema.virtual('messageCount').get(function() {
  return this.messages ? this.messages.length : 0;
});

// Virtual for last message
conversationSchema.virtual('lastMessage').get(function() {
  if (!this.messages || this.messages.length === 0) {
    return null;
  }
  
  const sortedMessages = this.messages.sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  return sortedMessages[0];
});

// Export the model
module.exports = mongoose.model('Conversation', conversationSchema);