const messageProcessor = require('../services/messageProcessor');

class WebhookController {
    
    // Webhook verification (GET request from Meta)
    static verifyWebhook(req, res) {
        console.log('📞 Webhook verification request received');
        
        // console.log('Request query parameters verifyWebhook:', req.query);

        // Parse query parameters
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        // console.log('Verification details:', { mode, token, challenge });
        
        // Check if mode and token are correct
        if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
            console.log('✅ Webhook verified successfully!');
            res.status(200).send(challenge);
        } else {
            console.log('❌ Webhook verification failed!');
            res.status(403).send('Verification failed');
        }
    }
    
    // Receive messages (POST request from Meta)
    static async receiveMessage(req, res) {
        // console.log('� === WEBHOOK RECEIVED ===');
        // console.log('📅 Timestamp:', new Date().toISOString());
        // console.log('🌐 Request URL:', req.url);
        // console.log('📧 Request method:', req.method);
        // console.log('🔗 Request headers:', JSON.stringify(req.headers, null, 2));
        
        try {
            const body = req.body;
            
            // Log the incoming webhook data
            // console.log('📦 === WEBHOOK BODY ===');
            // console.log(JSON.stringify(body, null, 2));
            // console.log('📦 === END WEBHOOK BODY ===');
            
            // Check if request body exists
            if (!body || Object.keys(body).length === 0) {
                // console.log('❌ Empty request body received');
                return res.status(200).send('Empty body received');
            }
            
            // Check if it's a WhatsApp message
            // console.log('🔍 Checking if object is whatsapp_business_account...');
            // console.log('🔍 body.object =', body.object);
            
            if (body.object === 'whatsapp_business_account') {
                // console.log('✅ Valid WhatsApp Business Account object detected');
                
                // Process each entry
                if (body.entry && body.entry.length > 0) {
                    console.log(`📋 Processing ${body.entry.length} entries...`);
                    
                    for (let i = 0; i < body.entry.length; i++) {
                        const entry = body.entry[i];
                        console.log(`🔄 Processing entry ${i + 1}:`, JSON.stringify(entry, null, 2));
                        
                        // Process changes in the entry
                        if (entry.changes && entry.changes.length > 0) {
                            console.log(`📝 Found ${entry.changes.length} changes in entry ${i + 1}`);
                            
                            for (let j = 0; j < entry.changes.length; j++) {
                                const change = entry.changes[j];
                                console.log(`🔄 Processing change ${j + 1}:`, JSON.stringify(change, null, 2));
                                
                                // Process messages
                                if (change.field === 'messages') {
                                    console.log('💬 Message field detected, calling messageProcessor...');
                                    await messageProcessor.processIncomingMessage(change.value);
                                    console.log('✅ messageProcessor completed');
                                } else {
                                    console.log(`ℹ️ Non-message field detected: ${change.field}`);
                                }
                            }
                        } else {
                            console.log(`⚠️ No changes found in entry ${i + 1}`);
                        }
                    }
                } else {
                    console.log('⚠️ No entries found in webhook body');
                }
            } else {
                console.log('ℹ️ Non-WhatsApp object received:', body.object);
            }
            
            // Always respond with 200 to acknowledge receipt
            // console.log('📤 Sending 200 OK response to Meta');
            res.status(200).send('Message received');
            console.log('🚨 === WEBHOOK PROCESSING COMPLETE ===\n');
            
        } catch (error) {
            console.error('❌ === WEBHOOK ERROR ===');
            console.error('Error processing webhook:', error);
            console.error('Error stack:', error.stack);
            console.error('❌ === END WEBHOOK ERROR ===');
            res.status(500).send('Internal server error');
        }
    }
}

module.exports = WebhookController;