const whatsappService = require('./whatsappService');
const databaseService = require('./databaseService');
const AIService = require('./aiService');

class MessageProcessor {
    
    constructor() {
        this.aiService = new AIService();
    }
    
    static async processIncomingMessage(messageData) {
        console.log('� === MESSAGE PROCESSOR STARTED ===');
        console.log('�🔄 Processing incoming message...');
        console.log('📦 Message data received:', JSON.stringify(messageData, null, 2));
        
        // Create instance for AI service access
        const processor = new MessageProcessor();
        console.log('✅ MessageProcessor instance created');
        
        try {
            // Extract message information
            const messages = messageData.messages || [];
            const contacts = messageData.contacts || [];
            
            console.log(`📋 Found ${messages.length} messages and ${contacts.length} contacts`);
            console.log('📨 Messages array:', JSON.stringify(messages, null, 2));
            console.log('👥 Contacts array:', JSON.stringify(contacts, null, 2));
            
            // Process each message
            for (const message of messages) {
                console.log('🔄 === PROCESSING MESSAGE ===');
                console.log('📨 Current message:', JSON.stringify(message, null, 2));
                // Get contact information
                const contact = contacts.find(c => c.wa_id === message.from);
                console.log('👤 Contact found:', contact ? JSON.stringify(contact, null, 2) : 'None');
                
                // Prepare message object for database
                const messageObj = {
                    messageId: message.id,
                    from: message.from,
                    to: messageData.metadata?.phone_number_id,
                    type: message.type,
                    timestamp: new Date(parseInt(message.timestamp) * 1000),
                    contact: contact ? {
                        name: contact.profile?.name || 'Unknown',
                        wa_id: contact.wa_id
                    } : null
                };
                
                console.log('📋 Basic message object created:', JSON.stringify(messageObj, null, 2));
                
                // Extract message content based on type
                console.log(`🔍 Processing message type: ${message.type}`);
                switch (message.type) {
                    case 'text':
                        messageObj.content = {
                            text: message.text?.body || ''
                        };
                        console.log('📝 Text message content:', messageObj.content);
                        break;
                        
                    case 'image':
                        messageObj.content = {
                            mediaId: message.image?.id,
                            mimeType: message.image?.mime_type,
                            caption: message.image?.caption || ''
                        };
                        console.log('🖼️ Image message content:', messageObj.content);
                        break;
                        
                    case 'audio':
                        messageObj.content = {
                            mediaId: message.audio?.id,
                            mimeType: message.audio?.mime_type
                        };
                        console.log('🔊 Audio message content:', messageObj.content);
                        break;
                        
                    case 'document':
                        messageObj.content = {
                            mediaId: message.document?.id,
                            mimeType: message.document?.mime_type,
                            filename: message.document?.filename
                        };
                        console.log('📄 Document message content:', messageObj.content);
                        break;
                        
                    default:
                        messageObj.content = { raw: message };
                        console.log('❓ Unknown message type, storing raw:', messageObj.content);
                }
                
                console.log('📝 Final message details:', JSON.stringify(messageObj, null, 2));
                
                // Store message in database (we'll implement this next)
                console.log('💾 Storing message in database...');
                await databaseService.storeMessage(messageObj);
                console.log('✅ Message stored in database');
                
                // Process ALL text messages with AI (removed the @bert/@ai trigger requirement)
                if (messageObj.type === 'text' && messageObj.content.text.trim()) {
                    console.log('🤖 Triggering AI processing for text message...');
                    console.log('💬 Text content:', messageObj.content.text);
                    await processor.processAIResponse(messageObj);
                    console.log('✅ AI processing completed');
                } else if (messageObj.type !== 'text') {
                    console.log(`📎 Non-text message received (${messageObj.type}), sending acknowledgment...`);
                    await whatsappService.sendMessage(
                        messageObj.from, 
                        "I received your message! Currently, I can only respond to text messages. Please send your message as text and I'll be happy to help! 📝"
                    );
                    console.log('✅ Acknowledgment sent for non-text message');
                } else {
                    console.log('⚠️ Empty text message received, skipping AI processing');
                }
                
                // Send acknowledgment (optional)
                console.log(`✅ Message processed: ${messageObj.messageId}`);
                console.log('🚨 === MESSAGE PROCESSING COMPLETE ===\n');
            }
            
        } catch (error) {
            console.error('❌ === MESSAGE PROCESSOR ERROR ===');
            console.error('Error in message processing:', error);
            console.error('Error stack:', error.stack);
            console.error('❌ === END MESSAGE PROCESSOR ERROR ===');
            throw error;
        }
    }
    
    static shouldTriggerAI(messageObj) {
        // Now we process ALL text messages with AI
        if (messageObj.type === 'text') {
            const text = messageObj.content.text.toLowerCase().trim();
            // Only skip empty messages
            return text.length > 0;
        }
        return false;
    }
    
    async processAIResponse(messageObj) {
        try {
            console.log('🚨 === AI RESPONSE PROCESSING STARTED ===');
            console.log('🤖 AI response triggered for message:', messageObj.messageId);
            console.log('📱 From phone:', messageObj.from);
            console.log('💬 User message:', messageObj.content.text);
            
            // Show typing indicator (optional enhancement)
            console.log('⏳ Processing with AI...');
            
            // Format phone number and get AI response
            console.log('📱 Formatting phone number...');
            const formattedPhone = this.aiService.formatPhoneNumber(messageObj.from);
            console.log('📱 Formatted phone:', formattedPhone);
            
            console.log('🔄 Calling AI service...');
            const aiResponse = await this.aiService.sendMessageToAI(
                messageObj.content.text, 
                formattedPhone
            );
            console.log('✅ AI service returned response');
            console.log('🎯 AI Response ready:', aiResponse);
            
            // Send AI response back to user
            console.log('📤 Sending AI response to WhatsApp...');
            await whatsappService.sendMessage(messageObj.from, aiResponse);
            
            console.log('✅ AI response sent successfully');
            console.log('🚨 === AI RESPONSE PROCESSING COMPLETE ===\n');
            
        } catch (error) {
            console.error('❌ === AI RESPONSE ERROR ===');
            console.error('Error in AI response processing:', error);
            console.error('Error stack:', error.stack);
            console.error('❌ === END AI RESPONSE ERROR ===');
            
            // Send fallback message to user
            const fallbackMessage = "I'm sorry, I'm having technical difficulties right now. Please try again in a moment! 🔧";
            
            try {
                console.log('📤 Sending fallback message...');
                await whatsappService.sendMessage(messageObj.from, fallbackMessage);
                console.log('✅ Fallback message sent');
            } catch (fallbackError) {
                console.error('❌ Failed to send fallback message:', fallbackError);
            }
        }
    }
}

module.exports = MessageProcessor;