const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// GET /webhook - For webhook verification
router.get('/', webhookController.verifyWebhook);

// POST /webhook - For receiving messages
router.post('/', webhookController.receiveMessage);

module.exports = router;