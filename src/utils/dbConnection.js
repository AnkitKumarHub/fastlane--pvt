/**
 * MongoDB Connection Configuration
 * Handles database connection with optimized pooling for 500-800 users
 */

const mongoose = require('mongoose');

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
  }

  /**
   * Initialize MongoDB connection with connection pooling
   * Optimized for 500-800 concurrent users
   */
  async connect() {
    if (this.isConnected) {
      console.log('[DB] Already connected to MongoDB');
      return;
    }

    const connectionOptions = {
      // Connection Pool Configuration
      maxPoolSize: 10,        // Maximum 10 connections in pool
      minPoolSize: 2,         // Minimum 2 connections always ready
      maxIdleTimeMS: 30000,   // Close connections after 30 seconds of inactivity
      serverSelectionTimeoutMS: 5000, // 5 seconds to select a server
      
      // Performance Optimizations
      bufferCommands: false,  // Disable mongoose buffering
      connectTimeoutMS: 10000, // 10 seconds connection timeout
      socketTimeoutMS: 45000,  // 45 seconds socket timeout
      
      // Additional Settings
      family: 4,              // Use IPv4, skip trying IPv6
      retryWrites: true,      // Retry writes on transient errors
      w: 'majority',          // Write concern for data safety
    };

    try {
      this.connectionAttempts++;
      console.log(`[DB] Attempting to connect to MongoDB (Attempt ${this.connectionAttempts})`);
      
      const conn = await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
      
      this.isConnected = true;
      console.log(`[DB] ✅ MongoDB Connected Successfully`);
      console.log(`[DB] 📍 Host: ${conn.connection.host}`);
      console.log(`[DB] 🗄️  Database: ${conn.connection.name}`);
      console.log(`[DB] 🔄 Pool Size: ${connectionOptions.maxPoolSize} connections`);
      
      // Set up connection event listeners
      this.setupEventListeners();
      
    } catch (error) {
      this.isConnected = false;
      console.error(`[DB] ❌ Connection Error (Attempt ${this.connectionAttempts}):`, error.message);
      
      if (this.connectionAttempts < this.maxRetries) {
        console.log(`[DB] 🔄 Retrying connection in 5 seconds...`);
        setTimeout(() => this.connect(), 5000);
      } else {
        console.error(`[DB] 💥 Max retry attempts reached. Exiting application.`);
        process.exit(1);
      }
    }
  }

  /**
   * Set up MongoDB connection event listeners
   */
  setupEventListeners() {
    const connection = mongoose.connection;

    connection.on('connected', () => {
      console.log('[DB] 🟢 Mongoose connected to MongoDB');
    });

    connection.on('error', (error) => {
      console.error('[DB] 🔴 Mongoose connection error:', error);
      this.isConnected = false;
    });

    connection.on('disconnected', () => {
      console.log('[DB] 🟡 Mongoose disconnected from MongoDB');
      this.isConnected = false;
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      this.disconnect();
    });

    process.on('SIGTERM', () => {
      this.disconnect();
    });
  }

  /**
   * Gracefully close database connection
   */
  async disconnect() {
    try {
      await mongoose.connection.close();
      console.log('[DB] 👋 MongoDB connection closed gracefully');
      process.exit(0);
    } catch (error) {
      console.error('[DB] ❌ Error during disconnection:', error);
      process.exit(1);
    }
  }

  /**
   * Check if database is connected
   */
  isDbConnected() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const connection = mongoose.connection;
    return {
      isConnected: this.isConnected,
      readyState: connection.readyState,
      host: connection.host,
      name: connection.name,
      collections: Object.keys(connection.collections)
    };
  }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

module.exports = dbConnection;