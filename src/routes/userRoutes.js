/**
 * User Routes
 * API endpoints for user management and NOC synchronization
 */

const express = require('express');
const UserController = require('../controllers/userController');

const router = express.Router();

/**
 * @route PUT /api/user/lynn-status
 * @desc Update Lynn user status (for NOC sync)
 * @access NOC
 * @body { whatsappId: string, lynnUserStatus: string }
 */
router.put('/lynn-status', UserController.updateLynnUserStatus);

/**
 * @route PUT /api/user/assigned-lm
 * @desc Update assigned to LM status (for NOC sync)
 * @access NOC
 * @body { whatsappId: string, assignedToLm: boolean }
 */
router.put('/assigned-lm', UserController.updateAssignedToLm);

/**
 * @route GET /api/user/:whatsappId
 * @desc Get user information
 * @access NOC
 * @param whatsappId - WhatsApp ID of the user
 */
router.get('/:whatsappId', UserController.getUserInfo);

module.exports = router;