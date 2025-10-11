/**
 * Firestore Configuration
 * Handles Firestore Database initialization and connection management
 */

const admin = require('firebase-admin');
const logger = require('./logger');
const constants = require('./constants');

class FirestoreConfig {
  constructor() {
    this.isInitialized = false;
    this.firestore = null;
    this.connectionRetries = 0;
  }

  /**
   * Initialize Firestore Database
   * Uses the existing Firebase Admin instance initialized by firebaseConfig
   */
  async initialize() {
    if (this.isInitialized) {
      logger.info('FirestoreConfig', 'Already initialized');
      return;
    }

    try {
      // Validate required environment variables
      this.validateEnvironmentVariables();

      // Use existing Firebase Admin app (initialized by firebaseConfig)
      let app;
      try {
        app = admin.app(); // Get default app - should exist from storage config
        logger.info('FirestoreConfig', 'Using existing Firebase Admin app');
      } catch (error) {
        throw new Error('Firebase Admin app not found. Ensure Firebase Storage is initialized first.');
      }

      // Initialize Firestore using existing app
      this.firestore = admin.firestore(app);

      // Configure Firestore settings for optimal performance
      this.firestore.settings({
        timestampsInSnapshots: true,
        ignoreUndefinedProperties: true
      });

      // Test connection with a simple operation
      await this.testConnection();

      this.isInitialized = true;
      logger.success('FirestoreConfig', 'Firestore Database initialized successfully', {
        projectId: process.env.FIREBASE_PROJECT_ID,
        collectionName: constants.FIRESTORE.COLLECTION_NAME
      });

    } catch (error) {
      this.connectionRetries++;
      logger.error('FirestoreConfig', `Initialization failed (attempt ${this.connectionRetries}): ${error.message}`, error);
      
      if (this.connectionRetries < constants.FIRESTORE.MAX_RETRIES) {
        logger.info('FirestoreConfig', `Retrying initialization in ${constants.FIRESTORE.RETRY_DELAY}ms...`);
        setTimeout(() => this.initialize(), constants.FIRESTORE.RETRY_DELAY);
        return;
      }
      
      throw new Error(`Firestore Database initialization failed after ${constants.FIRESTORE.MAX_RETRIES} attempts: ${error.message}`);
    }
  }

  /**
   * Test Firestore Database connection
   */
  async testConnection() {
    try {
      // Simple test: try to access Firestore settings
      const testCollection = this.firestore.collection('connection-test');
      const testDoc = testCollection.doc('test');
      
      // Write test data
      await testDoc.set({
        timestamp: admin.firestore.Timestamp.now(),
        test: true
      });
      
      // Read test data
      const snapshot = await testDoc.get();
      if (!snapshot.exists) {
        throw new Error('Firestore read/write test failed');
      }
      
      // Clean up test data
      await testDoc.delete();
      
      logger.debug('FirestoreConfig', 'Firestore Database connection test successful');
    } catch (error) {
      throw new Error(`Firestore Database connection test failed: ${error.message}`);
    }
  }

  /**
   * Validate required environment variables for Firestore
   */
  validateEnvironmentVariables() {
    const requiredVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing Firestore environment variables: ${missingVars.join(', ')}`);
    }
  }

  /**
   * Get Firestore Database instance
   */
  getFirestore() {
    if (!this.isInitialized || !this.firestore) {
      throw new Error('Firestore Database not initialized. Call initialize() first.');
    }
    return this.firestore;
  }

  /**
   * Get reference to main collection
   */
  getCollectionRef() {
    if (!this.isInitialized || !this.firestore) {
      throw new Error('Firestore Database not initialized. Call initialize() first.');
    }
    return this.firestore.collection(constants.FIRESTORE.COLLECTION_NAME);
  }

  /**
   * Get reference to specific user document
   */
  getUserDocRef(whatsappId) {
    if (!whatsappId) {
      throw new Error('whatsappId is required');
    }
    return this.getCollectionRef().doc(whatsappId);
  }

  /**
   * Get reference to user's messages collection
   */
  getUserMessagesCollectionRef(whatsappId) {
    if (!whatsappId) {
      throw new Error('whatsappId is required');
    }
    return this.getUserDocRef(whatsappId).collection('messages');
  }

  /**
   * Get reference to specific message document
   */
  getMessageDocRef(whatsappId, messageId) {
    if (!whatsappId || !messageId) {
      throw new Error('whatsappId and messageId are required');
    }
    return this.getUserMessagesCollectionRef(whatsappId).doc(messageId);
  }

  /**
   * Create batch operation for multiple writes
   */
  batch() {
    if (!this.isInitialized || !this.firestore) {
      throw new Error('Firestore Database not initialized. Call initialize() first.');
    }
    return this.firestore.batch();
  }

  /**
   * Create server timestamp
   */
  serverTimestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
  }

  /**
   * Create timestamp from date
   */
  timestamp(date = new Date()) {
    return admin.firestore.Timestamp.fromDate(date);
  }

  /**
   * Check if Firestore Database is initialized and ready
   */
  isReady() {
    return this.isInitialized && this.firestore !== null;
  }

  /**
   * Get Firestore Database configuration info
   */
  getConfigInfo() {
    return {
      isInitialized: this.isInitialized,
      projectId: process.env.FIREBASE_PROJECT_ID,
      collectionName: constants.FIRESTORE.COLLECTION_NAME,
      syncEnabled: constants.FIRESTORE.SYNC_ENABLED
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      if (this.firestore) {
        // Firestore doesn't require explicit shutdown like Realtime Database
        this.firestore = null;
      }
      this.isInitialized = false;
      logger.info('FirestoreConfig', 'Firestore Database shut down successfully');
    } catch (error) {
      logger.error('FirestoreConfig', `Error during shutdown: ${error.message}`, error);
      throw error;
    }
  }
}

// Create singleton instance
const firestoreConfig = new FirestoreConfig();

module.exports = firestoreConfig;