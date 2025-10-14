/**
 * Conversation Routes
 * API endpoints for conversation control operations
 */

const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');

// POST /api/conversation/takeover - LM takes over conversation
router.post('/takeover', conversationController.takeover);

// POST /api/conversation/release - LM releases conversation back to AI
router.post('/release', conversationController.release);

// GET /api/conversation/status/:phoneNumber - Get conversation status
router.get('/status/:phoneNumber', conversationController.getStatus);

// POST /api/conversation/lm/send - LM sends message to user
router.post('/lm/send', conversationController.sendLmMessage);

module.exports = router;
