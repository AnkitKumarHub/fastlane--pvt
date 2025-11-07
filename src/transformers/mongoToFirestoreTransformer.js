/**
 * MongoDB to Firestore Transformer
 * Handles data structure conversion between MongoDB documents and Firestore document format
 */

const logger = require('../utils/logger');
const admin = require('firebase-admin');

class MongoToFirestoreTransformer {
  
  /**
   * Transform MongoDB User document to Firestore user document structure
   */
  static transformUser(mongoUser) {
    try {
      if (!mongoUser) {
        throw new Error('MongoDB user document is required');
      }

      const firestoreUser = {
        displayName: mongoUser.displayName || null,
        phoneNumber: mongoUser.phoneNumber || null,
        conversationStatus: mongoUser.conversationStatus || 'AI',
        assignedLmId: mongoUser.assignedLmId || null,
        assignedToLm: mongoUser.assignedToLm !== undefined ? mongoUser.assignedToLm : false,
        lynnUserStatus: mongoUser.lynnUserStatus || "New User",
        lastTakeover: mongoUser.lastTakeover ? {
          timestamp: mongoUser.lastTakeover.timestamp ? 
            admin.firestore.Timestamp.fromDate(mongoUser.lastTakeover.timestamp) : null,
          lmId: mongoUser.lastTakeover.lmId || null,
          lmName: mongoUser.lastTakeover.lmName || null
        } : null,
        lastRelease: mongoUser.lastRelease ? {
          timestamp: mongoUser.lastRelease.timestamp ? 
            admin.firestore.Timestamp.fromDate(mongoUser.lastRelease.timestamp) : null,
          lmId: mongoUser.lastRelease.lmId || null,
          lmName: mongoUser.lastRelease.lmName || null
        } : null,
        isActive: mongoUser.isActive !== undefined ? mongoUser.isActive : true,
        totalMessageCount: mongoUser.totalMessageCount || 0,
        lastMessageUpdatedAt: mongoUser.lastMessageUpdatedAt ? 
          admin.firestore.Timestamp.fromDate(mongoUser.lastMessageUpdatedAt) : admin.firestore.Timestamp.now(),
        userMetrics: {
          lastMessage: mongoUser.userMetrics?.lastMessage || '',
          lastMessageTimestamp: mongoUser.userMetrics?.lastMessageTimestamp ? 
            admin.firestore.Timestamp.fromDate(mongoUser.userMetrics.lastMessageTimestamp) : null,
          messageCount: mongoUser.userMetrics?.messageCount || 0
        },
        aiMetrics: {
          lastMessage: mongoUser.aiMetrics?.lastMessage || '',
          lastMessageTimestamp: mongoUser.aiMetrics?.lastMessageTimestamp ? 
            admin.firestore.Timestamp.fromDate(mongoUser.aiMetrics.lastMessageTimestamp) : null,
          messageCount: mongoUser.aiMetrics?.messageCount || 0
        },
        lmMetrics: {
          lastMessage: mongoUser.lmMetrics?.lastMessage || '',
          lastMessageTimestamp: mongoUser.lmMetrics?.lastMessageTimestamp ? 
            admin.firestore.Timestamp.fromDate(mongoUser.lmMetrics.lastMessageTimestamp) : null,
          messageCount: mongoUser.lmMetrics?.messageCount || 0
        },
        createdAt: mongoUser.createdAt ? 
          admin.firestore.Timestamp.fromDate(mongoUser.createdAt) : admin.firestore.Timestamp.now(),
        updatedAt: mongoUser.updatedAt ? 
          admin.firestore.Timestamp.fromDate(mongoUser.updatedAt) : admin.firestore.Timestamp.now()
      };

      // Clean null values for Firestore (Firestore handles null better than Realtime DB)
      return this.cleanForFirestore(firestoreUser);

    } catch (error) {
      logger.error('MongoToFirestoreTransformer', `Failed to transform user: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Transform MongoDB message to Firestore message document structure
   */
  static transformMessage(mongoMessage) {
    try {
      if (!mongoMessage) {
        throw new Error('MongoDB message document is required');
      }

      // Debug logging: Track input data
      logger.debug('MongoToFirestoreTransformer', 'Transforming message for Firestore', {
        whatsappMessageId: mongoMessage.whatsappMessageId,
        direction: mongoMessage.direction,
        lmName_input: mongoMessage.assignedLmName,
        lmId_input: mongoMessage.assignedLmId,
        clientMessageId_input: mongoMessage.clientMessageId
      });

      const firestoreMessage = {
        whatsappMessageId: mongoMessage.whatsappMessageId, // Store WhatsApp ID as field
        direction: mongoMessage.direction,
        timestamp: mongoMessage.timestamp ? 
          admin.firestore.Timestamp.fromDate(mongoMessage.timestamp) : admin.firestore.Timestamp.now(),
        textContent: mongoMessage.textContent || '',
        assignedLmId: mongoMessage.assignedLmId || null,  // LM assignment tracking
        assignedLmName: mongoMessage.assignedLmName || null,  // LM name tracking - FIXED
        clientMessageId: mongoMessage.clientMessageId || null,  // Idempotency tracking
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      // Add mediaData if present
      if (mongoMessage.mediaData) {
        firestoreMessage.mediaData = {
          type: mongoMessage.mediaData.type,
          url: mongoMessage.mediaData.url,
          mimeType: mongoMessage.mediaData.mimeType || null,
          fileName: mongoMessage.mediaData.fileName || null,
          fileSize: mongoMessage.mediaData.fileSize || 0,
          storagePath: mongoMessage.mediaData.storagePath || null, // NEW: Include storagePath
          metadata: mongoMessage.mediaData.metadata || null        // NEW: Include metadata
        };
        
        console.log('🔍 DEBUG: mediaData transformed for Firestore:', JSON.stringify(firestoreMessage.mediaData, null, 2));
      }

      // Add reaction if present
      if (mongoMessage.reaction) {
        firestoreMessage.reaction = {
          emoji: mongoMessage.reaction.emoji,
          timestamp: mongoMessage.reaction.timestamp ? 
            admin.firestore.Timestamp.fromDate(mongoMessage.reaction.timestamp) : null,
          reactedBy: mongoMessage.reaction.reactedBy
        };
      }

      // Add aiAudit if present (only for AI messages)
      if (mongoMessage.aiAudit) {
        firestoreMessage.aiAudit = {
          checkpointId: mongoMessage.aiAudit.checkpointId,
          processingTimeMs: mongoMessage.aiAudit.processingTimeMs
        };
      }

      // Clean null values for Firestore
      const cleanedMessage = this.cleanForFirestore(firestoreMessage);

      // Debug logging: Track transformed output
      logger.debug('MongoToFirestoreTransformer', 'Message transformation completed', {
        whatsappMessageId: cleanedMessage.whatsappMessageId,
        lmName_output: cleanedMessage.assignedLmName,
        lmId_output: cleanedMessage.assignedLmId,
        clientMessageId_output: cleanedMessage.clientMessageId
      });

      return cleanedMessage;

    } catch (error) {
      logger.error('MongoToFirestoreTransformer', `Failed to transform message: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Transform conversation data for bulk operations
   */
  static transformConversation(mongoUser, mongoMessages = []) {
    try {
      const firestoreUser = this.transformUser(mongoUser);
      const firestoreMessages = mongoMessages.map(message => this.transformMessage(message));

      return {
        user: firestoreUser,
        messages: firestoreMessages
      };

    } catch (error) {
      logger.error('MongoToFirestoreTransformer', `Failed to transform conversation: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Clean null/undefined values for Firestore
   * Firestore handles null values better than Realtime Database
   */
  static cleanForFirestore(obj) {
    if (obj === null || obj === undefined) {
      return null; // Firestore accepts null values
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanForFirestore(item)).filter(item => item !== undefined);
    }

    if (obj instanceof admin.firestore.Timestamp) {
      return obj; // Keep Firestore Timestamps as-is
    }

    if (typeof obj === 'object') {
      const cleaned = {};
      Object.keys(obj).forEach(key => {
        const cleanedValue = this.cleanForFirestore(obj[key]);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      });
      return Object.keys(cleaned).length > 0 ? cleaned : null;
    }

    // For primitive values, keep them as is (strings, numbers, booleans)
    return obj;
  }

  /**
   * Create minimal user update object for Firestore (only changed fields)
   */
  static createUserUpdate(mongoUser, changedFields = []) {
    try {
      const fullTransform = this.transformUser(mongoUser);
      
      if (changedFields.length === 0) {
        // If no specific fields provided, return full transform
        return fullTransform;
      }

      const update = {};

      // Always include timestamp updates
      update.updatedAt = fullTransform.updatedAt;

      // Include only specified changed fields
      changedFields.forEach(field => {
        if (fullTransform[field] !== undefined) {
          update[field] = fullTransform[field];
        }
      });

      return this.cleanForFirestore(update);

    } catch (error) {
      logger.error('MongoToFirestoreTransformer', `Failed to create user update: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Convert Firestore document to plain object
   */
  static firestoreDocToObject(doc) {
    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    const result = { id: doc.id, ...data };

    // Convert Firestore Timestamps to Date objects for easier handling
    Object.keys(result).forEach(key => {
      if (result[key] instanceof admin.firestore.Timestamp) {
        result[key] = result[key].toDate();
      } else if (typeof result[key] === 'object' && result[key] !== null) {
        // Handle nested timestamps
        Object.keys(result[key]).forEach(nestedKey => {
          if (result[key][nestedKey] instanceof admin.firestore.Timestamp) {
            result[key][nestedKey] = result[key][nestedKey].toDate();
          }
        });
      }
    });

    return result;
  }

  /**
   * Convert Firestore query snapshot to array of objects
   */
  static firestoreQueryToArray(querySnapshot) {
    const results = [];
    querySnapshot.forEach(doc => {
      const data = this.firestoreDocToObject(doc);
      if (data) {
        results.push(data);
      }
    });
    return results;
  }

  /**
   * Validate transformed Firestore user structure
   */
  static validateFirestoreUser(firestoreUser) {
    const requiredFields = ['conversationStatus', 'isActive', 'totalMessageCount', 'userMetrics', 'aiMetrics', 'lmMetrics'];
    
    for (const field of requiredFields) {
      if (firestoreUser[field] === undefined) {
        throw new Error(`Required field '${field}' is missing from Firestore user data`);
      }
    }

    // Validate metrics structure
    const metricsFields = ['messageCount'];
    ['userMetrics', 'aiMetrics', 'lmMetrics'].forEach(metricsType => {
      for (const field of metricsFields) {
        if (firestoreUser[metricsType][field] === undefined) {
          throw new Error(`Required field '${field}' is missing from ${metricsType}`);
        }
      }
    });

    return true;
  }

  /**
   * Validate transformed Firestore message structure
   */
  static validateFirestoreMessage(firestoreMessage) {
    const requiredFields = ['whatsappMessageId', 'direction', 'timestamp', 'textContent'];
    
    for (const field of requiredFields) {
      if (firestoreMessage[field] === undefined) {
        throw new Error(`Required field '${field}' is missing from Firestore message data`);
      }
    }

    // Validate LM-specific fields if this is an LM message
    if (firestoreMessage.direction === 'outbound_lm') {
      if (firestoreMessage.assignedLmId === undefined) {
        logger.warn('MongoToFirestoreTransformer', 'LM message missing assignedLmId field', {
          whatsappMessageId: firestoreMessage.whatsappMessageId
        });
      }
      if (firestoreMessage.assignedLmName === undefined) {
        logger.warn('MongoToFirestoreTransformer', 'LM message missing assignedLmName field', {
          whatsappMessageId: firestoreMessage.whatsappMessageId
        });
      }
      if (firestoreMessage.clientMessageId === undefined) {
        logger.warn('MongoToFirestoreTransformer', 'LM message missing clientMessageId field', {
          whatsappMessageId: firestoreMessage.whatsappMessageId
        });
      }
    }

    return true;
  }

  /**
   * Create Firestore batch operation data
   */
  static createBatchData(operations) {
    const batchOps = [];
    
    operations.forEach(op => {
      switch (op.type) {
        case 'set':
          batchOps.push({
            type: 'set',
            ref: op.ref,
            data: this.cleanForFirestore(op.data),
            options: op.options || {}
          });
          break;
        case 'update':
          batchOps.push({
            type: 'update',
            ref: op.ref,
            data: this.cleanForFirestore(op.data)
          });
          break;
        case 'delete':
          batchOps.push({
            type: 'delete',
            ref: op.ref
          });
          break;
        default:
          throw new Error(`Unknown batch operation type: ${op.type}`);
      }
    });

    return batchOps;
  }
}

module.exports = MongoToFirestoreTransformer;