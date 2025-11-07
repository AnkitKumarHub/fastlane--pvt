const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

class WhatsAppService {
    
    static async sendMessage(to, message, type = 'text') {
        try {
            console.log('🚨 === WHATSAPP Send MESSAGE ===');
            // console.log(`📤 Preparing to send message to ${to}`);
            // console.log(`💬 Message: ${message}`);
            // console.log(`📝 Type: ${type}`);
            
            const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
            // console.log('🔗 API URL:', url);
            // console.log('📞 Phone Number ID:', process.env.WHATSAPP_PHONE_NUMBER_ID);
            
            const payload = {
                messaging_product: 'whatsapp',
                to: to,
                // type: type,
                text: {
                    body: message
                }
            };
            
            // console.log('📦 Request payload:', JSON.stringify(payload, null, 2));
            
            const config = {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            };
            
            // console.log('🔧 Request config (token masked):', JSON.stringify({
            //     headers: {
            //         'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN ? process.env.WHATSAPP_ACCESS_TOKEN.substring(0, 20) + '...' : 'NOT_SET'}`,
            //         'Content-Type': config.headers['Content-Type']
            //     }
            // }, null, 2));
            
            console.log(`📡 Making API request to WhatsApp...`);
            
            const response = await axios.post(url, payload, config);
            
            // console.log('✅ WhatsApp API Response Status:', response.status);
            // console.log('✅ WhatsApp API Response Data:', JSON.stringify(response.data, null, 2));
            console.log('🚨 === WHATSAPP SEND COMPLETE ===\n');
            
            return response.data;
            
        } catch (error) {
            console.error('❌ === WHATSAPP SEND ERROR ===');
            console.error('Error sending message to WhatsApp:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response headers:', error.response.headers);
                console.error('Response data:', JSON.stringify(error.response.data, null, 2));
            }
            console.error('Error config:', error.config ? {
                url: error.config.url,
                method: error.config.method,
                headers: error.config.headers
            } : 'No config');
            console.error('❌ === END WHATSAPP SEND ERROR ===');
            throw error;
        }
    }

    /**
     * Download media file from WhatsApp using media ID
     * @param {string} mediaId - WhatsApp media ID
     * @returns {Object} - {buffer, mimeType, fileSize, filename}
     */
    static async downloadMedia(mediaId) {
        try {
            // console.log('🚨 === WHATSAPP MEDIA DOWNLOAD ===');
            // console.log(`📥 Downloading media with ID: ${mediaId}`);
            
            // Step 1: Get media URL from WhatsApp API
            const mediaUrlEndpoint = `https://graph.facebook.com/v20.0/${mediaId}`;
            // console.log('🔗 Getting media URL from:', mediaUrlEndpoint);
            
            const mediaUrlResponse = await axios.get(mediaUrlEndpoint, {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
                }
            });
            
            // console.log('✅ Media URL response:', JSON.stringify(mediaUrlResponse.data, null, 2));
            const mediaUrl = mediaUrlResponse.data.url;
            const mimeType = mediaUrlResponse.data.mime_type;
            const fileSize = mediaUrlResponse.data.file_size;
            
            // Step 2: Download actual media file
            // console.log('📥 Downloading media file from:', mediaUrl);
            const mediaResponse = await axios.get(mediaUrl, {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
                },
                responseType: 'arraybuffer',
                timeout: 30000 // 30 seconds timeout for media download
            });
            
            console.log('✅ Media downloaded successfully');
            // console.log(`📊 File size: ${mediaResponse.data.byteLength} bytes`);
            // console.log(`📋 MIME type: ${mimeType}`);
            
            const result = {
                buffer: Buffer.from(mediaResponse.data),
                mimeType: mimeType,
                fileSize: fileSize || mediaResponse.data.byteLength,
                filename: `media_${Date.now()}.${this.getFileExtension(mimeType)}`
            };
            
            console.log('🚨 === WHATSAPP MEDIA DOWNLOAD COMPLETE ===');
            return result;
            
        } catch (error) {
            console.error('❌ === WHATSAPP MEDIA DOWNLOAD ERROR ===');
            console.error('Error downloading media:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            console.error('❌ === END WHATSAPP MEDIA DOWNLOAD ERROR ===');
            throw new Error(`Failed to download media: ${error.message}`);
        }
    }

    /**
     * Mark a message as read and show typing indicator (combined operation)
     * Uses Meta's v24.0+ combined API format for best performance
     * @param {string} messageId - WhatsApp message ID
     * @param {string} phoneNumber - Recipient phone number (for logging)
     * @returns {Promise<Object>} - API response
     */
    static async markMessageAsReadAndShowTyping(messageId, phoneNumber) {
        try {
            console.log(`🔵 Combined operation: Marking message ${messageId} as read + showing typing to ${phoneNumber}`);
            
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
            
            const response = await axios.post(url, payload, config);
            console.log(`✅ Combined operation successful for message ${messageId}`);
            return response.data;
            
        } catch (error) {
            console.error(`❌ Combined operation failed for message ${messageId}:`, error.message);
            if (error.response) {
                console.error('Combined API Error:', error.response.data);
            }
            throw error;
        }
    }

    /**
     * Mark a message as read (blue tick for user)
     * @param {string} messageId - WhatsApp message ID
     * @returns {Promise<Object>} - API response
     */
    static async markMessageAsRead(messageId) {
        try {
            console.log(`📖 Marking message as read: ${messageId}`);
            
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
            console.log(`✅ Message ${messageId} marked as read`);
            return response.data;
            
        } catch (error) {
            console.error(`❌ Failed to mark message ${messageId} as read:`, error.message);
            if (error.response) {
                console.error('Read Status Error:', error.response.data);
            }
            throw error;
        }
    }

    /**
     * Show typing indicator to user
     * @param {string} phoneNumber - Recipient phone number
     * @returns {Promise<Object>} - API response
     */
    static async showTypingIndicator(phoneNumber) {
        try {
            console.log(`⌨️ Showing typing indicator to: ${phoneNumber}`);
            
            const url = `https://graph.facebook.com/v24.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
            
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: phoneNumber,
                type: "typing",
                typing: {
                    action: "typing_on"
                }
            };
            
            const config = {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            };
            
            const response = await axios.post(url, payload, config);
            console.log(`✅ Typing indicator shown to ${phoneNumber}`);
            return response.data;
            
        } catch (error) {
            console.error(`❌ Failed to show typing indicator to ${phoneNumber}:`, error.message);
            if (error.response) {
                console.error('Typing Indicator Error:', error.response.data);
            }
            throw error;
        }
    }

    /**
     * Get file extension from MIME type
     * @param {string} mimeType - MIME type
     * @returns {string} - File extension
     */
    static getFileExtension(mimeType) {
        const mimeToExt = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'audio/mpeg': 'mp3',
            'audio/wav': 'wav',
            'audio/aac': 'aac',
            'audio/ogg': 'ogg',
            'video/mp4': 'mp4',
            'video/avi': 'avi',
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
        };
        
        return mimeToExt[mimeType] || 'bin';
    }
}

module.exports = WhatsAppService;