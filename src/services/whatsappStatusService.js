const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

/**
 * WhatsApp Status Service
 * Handles marking messages as read and showing typing indicators
 * Based on Meta Graph API v24.0+ features
 */
class WhatsAppStatusService {
    
    /**
     * Mark a message as read and show typing indicator (combined operation)
     * This is the main method to call for immediate user feedback
     * Uses Meta's v24.0+ combined API format
     * @param {string} messageId - WhatsApp message ID to mark as read
     * @param {string} phoneNumber - Recipient phone number (for logging only)
     * @returns {Promise<{success: boolean}>}
     */
    static async markMessageAsReadAndShowTyping(messageId, phoneNumber) {
        console.log('🔵 === WHATSAPP COMBINED STATUS OPERATION STARTED ===');
        console.log(`📨 Message ID: ${messageId}`);
        console.log(`📞 Phone Number: ${phoneNumber}`);
        
        // Debug: Check environment variables
        console.log(`🔧 Phone Number ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID ? process.env.WHATSAPP_PHONE_NUMBER_ID.substring(0, 10) + '...' : 'NOT_SET'}`);
        console.log(`🔧 Access Token: ${process.env.WHATSAPP_ACCESS_TOKEN ? process.env.WHATSAPP_ACCESS_TOKEN.substring(0, 20) + '...' : 'NOT_SET'}`);
        
        try {
            // ✅ Combined API call - Mark as read + Show typing indicator
            const url = `https://graph.facebook.com/v24.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
            
            const payload = {
                messaging_product: "whatsapp",
                status: "read",
                message_id: messageId,
                typing_indicator: { type: "text" }
            };
            
            const config = {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            };
            
            console.log('📡 Making combined API request for read status + typing indicator...');
            console.log('📦 Request payload:', JSON.stringify(payload, null, 2));
            const response = await axios.post(url, payload, config);
            
            console.log('📈 API Response Status:', response.status);
            console.log('📈 API Response Data:', JSON.stringify(response.data, null, 2));
            console.log('✅ Combined operation successful - Message marked as read + Typing indicator shown');
            console.log(`💬 Typing indicator shown for message ${messageId}`);
            console.log('🔵 === COMBINED STATUS OPERATION COMPLETE ===');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ === COMBINED STATUS OPERATION ERROR ===');
            console.error(`Failed to mark message ${messageId} as read and show typing:`, error.message);
            if (error.response) {
                console.error('Combined API Error Details:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
            console.error('❌ === END COMBINED STATUS OPERATION ERROR ===');
            return { success: false };
        }
    }
    
    /**
     * Mark a specific message as read ONLY (for testing)
     * @param {string} messageId - WhatsApp message ID
     * @returns {Promise<boolean>}
     */
    static async markMessageAsReadOnly(messageId) {
        try {
            console.log(`🔍 DEBUG: Testing read status ONLY for: ${messageId}`);
            
            const url = `https://graph.facebook.com/v24.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
            
            const payload = {
                messaging_product: "whatsapp",
                status: "read",
                message_id: messageId
                // NO typing_indicator - testing read status alone
            };
            
            const config = {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            };
            
            console.log('📦 Read-only payload:', JSON.stringify(payload, null, 2));
            const response = await axios.post(url, payload, config);
            
            console.log('📈 Read-only response status:', response.status);
            console.log('📈 Read-only response data:', JSON.stringify(response.data, null, 2));
            console.log(`✅ Read status ONLY successful for ${messageId}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Read status ONLY failed for ${messageId}:`, error.message);
            if (error.response) {
                console.error('Read Status Only API Error:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
            return false;
        }
    }

    /**
     * Mark a specific message as read (individual operation - for standalone use)
     * @param {string} messageId - WhatsApp message ID
     * @returns {Promise<boolean>}
     */
    static async markMessageAsRead(messageId) {
        try {
            console.log(`📖 Marking message as read (standalone): ${messageId}`);
            
            const url = `https://graph.facebook.com/v24.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
            
            const payload = {
                messaging_product: "whatsapp",
                status: "read",
                message_id: messageId
            };
            
            const config = {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            };
            
            const response = await axios.post(url, payload, config);
            
            console.log(`✅ Message ${messageId} marked as read successfully (standalone)`);
            return true;
            
        } catch (error) {
            console.error(`❌ Failed to mark message ${messageId} as read (standalone):`, error.message);
            if (error.response) {
                console.error('Read Status API Error:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
            return false;
        }
    }
}

module.exports = WhatsAppStatusService;