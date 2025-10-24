/**
 * Firebase Configuration
 * Handles Firebase Admin SDK initialization for media storage and Firestore access
 */

const admin = require('firebase-admin');

class FirebaseConfig {
  constructor() {
    this.isInitialized = false;
    this.storage = null;
    this.bucket = null;
  }

  /**
   * Initialize Firebase Admin SDK
   * Uses environment variables for security
   */
  initialize() {
    if (this.isInitialized) {
      console.log('[Firebase] Already initialized');
      return;
    }

    try {
      // Validate required environment variables
      this.validateEnvironmentVariables();

      // Initialize Firebase Admin with service account
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
      };

      // Initialize Firebase Admin
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });

      // Initialize storage
      this.storage = admin.storage();
      this.bucket = this.storage.bucket();

      this.isInitialized = true;
      console.log('[Firebase] ✅ Firebase Admin initialized successfully');
      console.log(`[Firebase] 📦 Storage bucket: ${process.env.FIREBASE_STORAGE_BUCKET}`);
      // console.log('[Firebase] 🔐 Public read access configured');

    } catch (error) {
      console.error('[Firebase] ❌ Initialization error:', error.message);
      throw new Error(`Firebase initialization failed: ${error.message}`);
    }
  }

  /**
   * Validate required environment variables
   */
  validateEnvironmentVariables() {
    const requiredVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID',
      'FIREBASE_STORAGE_BUCKET'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing Firebase environment variables: ${missingVars.join(', ')}`);
    }

    // Validate private key format
    if (!process.env.FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
      throw new Error('FIREBASE_PRIVATE_KEY must be a valid private key with BEGIN/END markers');
    }

    // Validate email format
    if (!process.env.FIREBASE_CLIENT_EMAIL.includes('@')) {
      throw new Error('FIREBASE_CLIENT_EMAIL must be a valid service account email');
    }
  }

  /**
   * Get Firebase storage bucket instance
   */
  getBucket() {
    if (!this.isInitialized) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }
    return this.bucket;
  }

  /**
   * Get Firebase storage instance
   */
  getStorage() {
    if (!this.isInitialized) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }
    return this.storage;
  }

  /**
   * Check if Firebase is initialized
   */
  isFirebaseReady() {
    return this.isInitialized;
  }

  /**
   * Generate file path for WhatsApp media (Legacy format - for backward compatibility)
   * Format: /{MEDIA_PATH_PREFIX}/{whatsappId}/{messageId}.{extension}
   * @deprecated Use PathGenerator.generateMediaPath for new structured paths
   */
  generateMediaPath(whatsappId, messageId, fileExtension) {
    if (!whatsappId || !messageId || !fileExtension) {
      throw new Error('whatsappId, messageId, and fileExtension are required');
    }

    // Import constants for centralized configuration
    const constants = require('./constants');

    // Clean inputs to prevent path injection
    const cleanWhatsappId = whatsappId.replace(/[^a-zA-Z0-9-_]/g, '');
    const cleanMessageId = messageId.replace(/[^a-zA-Z0-9-_.]/g, '');
    const cleanExtension = fileExtension.replace(/[^a-zA-Z0-9]/g, '');

    return `${constants.FIREBASE.MEDIA_PATH_PREFIX}/${cleanWhatsappId}/${cleanMessageId}.${cleanExtension}`;
  }

  /**
   * Get Firebase configuration info
   */
  getConfigInfo() {
    return {
      isInitialized: this.isInitialized,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    };
  }
}

// Create singleton instance
const firebaseConfig = new FirebaseConfig();

module.exports = firebaseConfig;