const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import routes
const webhookRoutes = require('./src/routes/webhookRoutes');

// Use routes
app.use('/webhook', webhookRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'WhatsApp Lifestyle Bot is running!'
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚨 === SERVER STARTUP ===');
});

module.exports = app;