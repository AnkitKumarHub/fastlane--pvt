const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import services and middleware
const { databaseService } = require('./src/services');
const ErrorHandler = require('./src/middleware/errorHandler');
const CorsConfig = require('./src/config/corsConfig');
const logger = require('./src/utils/logger');

const app = express();
const PORT = process.env.WHATSAPP_API_PORT || 8080;

// Setup global error handlers
ErrorHandler.setupGlobalHandlers();

// CORS Configuration
const corsOptions = CorsConfig.getCorsOptions();
app.use(cors(corsOptions));

// Validate and log CORS configuration
CorsConfig.validateConfiguration();
CorsConfig.logConfiguration();

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  req.requestId = requestId;
  
  logger.api(req.method, req.url, null, null);
  next();
});

// Import routes
const webhookRoutes = require('./src/routes/webhookRoutes');
const conversationRoutes = require('./src/routes/conversationRoutes');

// Use routes
app.use('/webhook', webhookRoutes);
app.use('/api/conversation', conversationRoutes);

// Health check endpoint with database status
app.get('/health', async (req, res) => {
  try {
    const health = await databaseService.healthCheck();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'WhatsApp Lifestyle Bot is running!',
      services: health.services,
      database: health.overall
    });
  } catch (error) {
    logger.error('Server', 'Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      message: 'Service degraded',
      error: error.message
    });
  }
});

// 404 handler
app.use('*', ErrorHandler.handle404);

// Global error handler
app.use(ErrorHandler.handleError);

// Initialize database and start server
async function startServer() {
  try {
    logger.startup('Server', 'Starting WhatsApp Business AI Platform...');
    
    // Initialize database services
    await databaseService.initialize();
    logger.startup('Database', 'All database services initialized successfully');
    
    // Start the server
    const server = app.listen(PORT, () => {
      logger.startup('Server', `Server started successfully on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
      });
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      logger.info('Server', `Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('Server', 'HTTP server closed');
        
        try {
          await databaseService.shutdown();
          logger.success('Server', 'Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Server', 'Error during shutdown', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Server', 'Failed to start server', error);
    process.exit(1);
  }
}

// Start the application
startServer();

module.exports = app;