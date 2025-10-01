const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

class WhatsAppService {
    
    static async sendMessage(to, message, type = 'text') {
        try {
            console.log('🚨 === WHATSAPP Send MESSAGE ===');
            console.log(`📤 Preparing to send message to ${to}`);
            console.log(`💬 Message: ${message}`);
            console.log(`📝 Type: ${type}`);
            
            const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
            console.log('🔗 API URL:', url);
            console.log('📞 Phone Number ID:', process.env.WHATSAPP_PHONE_NUMBER_ID);
            
            const payload = {
                messaging_product: 'whatsapp',
                to: to,
                // type: type,
                text: {
                    body: message
                }
            };
            
            console.log('📦 Request payload:', JSON.stringify(payload, null, 2));
            
            const config = {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            };
            
            console.log('🔧 Request config (token masked):', JSON.stringify({
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN ? process.env.WHATSAPP_ACCESS_TOKEN.substring(0, 20) + '...' : 'NOT_SET'}`,
                    'Content-Type': config.headers['Content-Type']
                }
            }, null, 2));
            
            console.log(`📡 Making API request to WhatsApp...`);
            
            const response = await axios.post(url, payload, config);
            
            console.log('✅ WhatsApp API Response Status:', response.status);
            console.log('✅ WhatsApp API Response Data:', JSON.stringify(response.data, null, 2));
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
}

module.exports = WhatsAppService;