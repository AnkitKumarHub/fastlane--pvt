const whatsappService = require('./whatsappService');
const databaseService = require('./databaseService');
const mediaService = require('./mediaService');
const aiService = require('./aiService');
const constants = require('../utils/constants');

class MessageProcessor {
    
    constructor() {
        this.aiService = aiService;
    }
    
    static async processIncomingMessage(messageData) {
        console.log('🚨 === MESSAGE PROCESSOR STARTED ===');
        // console.log('🔄 Processing incoming message...');
        console.log('📦 Message data received:', JSON.stringify(messageData, null, 2));
        
        // Create instance for AI service access
        const processor = new MessageProcessor();
        // console.log('✅ MessageProcessor instance created');
        
        try {
            // Extract message information
            const messages = messageData.messages || [];
            const contacts = messageData.contacts || [];
            
            // console.log(`📋 Found ${messages.length} messages and ${contacts.length} contacts`);
            // console.log('📨 Messages array:', JSON.stringify(messages, null, 2));
            // console.log('👥 Contacts array:', JSON.stringify(contacts, null, 2));
            
            // Process each message
            for (const message of messages) {
                console.log('🔄 === PROCESSING MESSAGE ===');
                // console.log('📨 Current message:', JSON.stringify(message, null, 2));
                // Get contact information
                const contact = contacts.find(c => c.wa_id === message.from);
                // console.log('👤 Contact found:', contact ? JSON.stringify(contact, null, 2) : 'None');
                
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
                
                // console.log('📋 Basic message object created:', JSON.stringify(messageObj, null, 2));
                
                // Extract message content based on type
                // console.log(`🔍 Processing message type: ${message.type}`);
                
                // Initialize media processing variables
                let mediaData = null;
                let mediaProcessingError = null;
                
                switch (message.type) {
                    case 'text':
                        messageObj.content = {
                            text: message.text?.body || ''
                        };
                        // console.log('📝 Text message content:', messageObj.content);
                        break;
                        
                    case 'image':
                        messageObj.content = {
                            mediaId: message.image?.id,
                            mimeType: message.image?.mime_type,
                            caption: message.image?.caption || ''
                        };
                        // console.log('🖼️ Image message content:', messageObj.content);
                        
                        // Process image media
                        try {
                            // console.log('📥 Processing image media...');
                            const downloadedMedia = await whatsappService.downloadMedia(message.image.id);
                            mediaData = await mediaService.uploadMediaFile(
                                downloadedMedia.buffer,
                                messageObj.from,
                                messageObj.messageId,
                                downloadedMedia.filename,
                                downloadedMedia.mimeType
                            );
                            messageObj.content.mediaUrl = mediaData.url;
                            // console.log('✅ Image media processed successfully:', mediaData.url);
                        } catch (error) {
                            console.error('❌ Image media processing failed:', error.message);
                            mediaProcessingError = error.message;
                        }
                        break;
                        
                    case 'audio':
                        messageObj.content = {
                            mediaId: message.audio?.id,
                            mimeType: message.audio?.mime_type
                        };
                        // console.log('🔊 Audio message content:', messageObj.content);
                        
                        // Process audio media
                        try {
                            // console.log('📥 Processing audio media...');
                            const downloadedMedia = await whatsappService.downloadMedia(message.audio.id);
                            mediaData = await mediaService.uploadMediaFile(
                                downloadedMedia.buffer,
                                messageObj.from,
                                messageObj.messageId,
                                downloadedMedia.filename,
                                downloadedMedia.mimeType
                            );
                            messageObj.content.mediaUrl = mediaData.url;
                            // console.log('✅ Audio media processed successfully:', mediaData.url);
                        } catch (error) {
                            console.error('❌ Audio media processing failed:', error.message);
                            mediaProcessingError = error.message;
                        }
                        break;
                        
                    case 'document':
                        messageObj.content = {
                            mediaId: message.document?.id,
                            mimeType: message.document?.mime_type,
                            filename: message.document?.filename
                        };
                        // console.log('📄 Document message content:', messageObj.content);
                        
                        // Process document media
                        try {
                            // console.log('📥 Processing document media...');
                            const downloadedMedia = await whatsappService.downloadMedia(message.document.id);
                            // Use original filename if available
                            const filename = message.document.filename || downloadedMedia.filename;
                            mediaData = await mediaService.uploadMediaFile(
                                downloadedMedia.buffer,
                                messageObj.from,
                                messageObj.messageId,
                                filename,
                                downloadedMedia.mimeType
                            );
                            messageObj.content.mediaUrl = mediaData.url;
                            // console.log('✅ Document media processed successfully:', mediaData.url);
                        } catch (error) {
                            console.error('❌ Document media processing failed:', error.message);
                            mediaProcessingError = error.message;
                        }
                        break;
                        
                    default:
                        messageObj.content = { raw: message };
                        // console.log('❓ Unknown message type, storing raw:', messageObj.content);
                }
                
                console.log('📝 Final message details:', JSON.stringify(messageObj, null, 2));
                
                // Store message in database using existing processIncomingMessage method
                console.log('💾 Storing message in database...');
                try {
                    const whatsappId = messageObj.from;
                    
                    // Create meaningful textContent based on message type
                    let textContent = '';
                    switch (messageObj.type) {
                        case 'text':
                            textContent = messageObj.content?.text || '';
                            break;
                        case 'image':
                            if (mediaProcessingError) {
                                textContent = `[IMAGE] ${messageObj.content?.caption || 'Photo'} - Processing failed: ${mediaProcessingError}`;
                            } else {
                                textContent = `[IMAGE] ${messageObj.content?.caption || 'Photo'}`;
                            }
                            break;
                        case 'audio':
                            if (mediaProcessingError) {
                                textContent = '[AUDIO] Voice message - Processing failed: ' + mediaProcessingError;
                            } else {
                                textContent = '[AUDIO] Voice message';
                            }
                            break;
                        case 'document':
                            if (mediaProcessingError) {
                                textContent = `[DOCUMENT] ${messageObj.content?.filename || 'File'} - Processing failed: ${mediaProcessingError}`;
                            } else {
                                textContent = `[DOCUMENT] ${messageObj.content?.filename || 'File'}`;
                            }
                            break;
                        default:
                            textContent = `[${messageObj.type.toUpperCase()}] Media message`;
                    }
                    
                    const messageData = {
                        whatsappMessageId: messageObj.messageId,
                        textContent: textContent,
                        timestamp: messageObj.timestamp,
                        senderName: messageObj.contact?.name,
                        phoneNumber: messageObj.from // Use whatsappId as phone number
                    };
                    
                    // Add media information if processing was successful
                    if (mediaData && mediaData.url) {
                        messageData.mediaUrl = mediaData.url;
                        messageData.mediaType = mediaData.type;
                        messageData.mimeType = mediaData.mimeType;
                        messageData.fileName = mediaData.fileName;
                        messageData.fileSize = mediaData.fileSize;
                        // console.log('📎 Media information added to database:', {
                        //     url: mediaData.url,
                        //     type: mediaData.type,
                        //     mimeType: mediaData.mimeType
                        // });
                    }
                    
                    const result = await databaseService.processIncomingMessage(whatsappId, messageData);
                    console.log('✅ Message stored successfully:', {
                        user: result.user.whatsappId,
                        totalMessages: result.user.totalMessageCount,
                        processingTime: result.processingTimeMs + 'ms'
                    });
                } catch (dbError) {
                    console.error('❌ Database storage failed:', dbError.message);
                    // Continue processing even if DB fails
                }
                
                // Process ALL text messages with AI (removed the @bert/@ai trigger requirement)
                if (messageObj.type === 'text' && messageObj.content.text.trim()) {
                    console.log('🤖 Triggering AI processing for text message...');
                    // console.log('💬 Text content:', messageObj.content.text);
                    await processor.processAIResponse(messageObj);
                    console.log('✅ AI processing completed');
                } else if (messageObj.type !== 'text') {
                    // console.log(`📎 Non-text message received (${messageObj.type}), sending acknowledgment...`);
                    
                    const acknowledgmentText = "I received your message! Currently, I can only respond to text messages. Please send your message as text and I'll be happy to help! 📝";
                    
                    const whatsappResponse = await whatsappService.sendMessage(messageObj.from, acknowledgmentText);
                    // console.log('✅ Acknowledgment sent for non-text message');
                    
                    // Store acknowledgment in database for data consistency
                    if (whatsappResponse && whatsappResponse.messages && whatsappResponse.messages[0]) {
                        // console.log('💾 Storing acknowledgment in database...');
                        try {
                            const aiAuditData = {
                                checkpointId: `ack_${Date.now()}`,
                                processingTimeMs: 100
                            };
                            
                            await databaseService.processOutgoingAiMessage(
                                messageObj.from,
                                {
                                    whatsappMessageId: whatsappResponse.messages[0].id,
                                    textContent: acknowledgmentText,
                                    timestamp: new Date()
                                },
                                aiAuditData
                            );
                            
                            // console.log('✅ Acknowledgment stored in database successfully');
                        } catch (dbError) {
                            console.error('❌ Failed to store acknowledgment:', dbError.message);
                            // Continue processing - don't fail entire flow
                        }
                    } else {
                        console.error('⚠️ No message ID received from WhatsApp API for acknowledgment');
                    }
                } else {
                    // console.log('⚠️ Empty text message received, skipping AI processing');
                }
                
                // Send acknowledgment (optional)
                // console.log(`✅ Message processed: ${messageObj.messageId}`);
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
            
            const whatsappId = messageObj.from;
            
            // ✅ Check conversation status BEFORE processing
            const user = await databaseService.userService.findUserByWhatsappId(whatsappId);
            const conversationStatus = user?.conversationStatus || constants.CONVERSATION_STATUS.AI;
            
            console.log('📊 Conversation Status:', conversationStatus);
            if (user?.assignedLmId) {
                console.log('👤 Assigned LM:', user.assignedLmId);
            }
            
            // Format phone number and get AI response
            const formattedPhone = this.aiService.formatPhoneNumber(whatsappId);
            
            // ✅ Pass conversationStatus as 4th parameter
            const aiResponse = await this.aiService.sendMessageToAI(
                messageObj.content.text,
                formattedPhone,
                conversationStatus  
            );
            
            console.log('✅ AI service returned response');
            console.log('🎯 AI Response ready:', aiResponse);
            
            // ✅ Only send message to user if status is AI
            if (conversationStatus === constants.CONVERSATION_STATUS.AI) {
                console.log('📤 Sending AI response to WhatsApp (AI mode)...');
                
                const whatsappResponse = await whatsappService.sendMessage(messageObj.from, aiResponse);
                
                // Store AI response in database
                if (whatsappResponse && whatsappResponse.messages && whatsappResponse.messages[0]) {
                    const aiMessageId = whatsappResponse.messages[0].id;
                    console.log('💾 Storing AI response in database...');
                    
                    try {
                        const aiAuditData = {
                            checkpointId: `ai_${Date.now()}`,
                            processingTimeMs: Date.now() - new Date(messageObj.timestamp).getTime()
                        };
                        
                        await databaseService.processOutgoingAiMessage(
                            messageObj.from,
                            {
                                whatsappMessageId: aiMessageId,
                                textContent: aiResponse,
                                timestamp: new Date()
                            },
                            aiAuditData
                        );
                        
                        console.log('✅ AI response stored in database successfully');
                    } catch (dbError) {
                        console.error('❌ Failed to store AI response in database:', dbError.message);
                    }
                } else {
                    console.error('⚠️ No message ID received from WhatsApp API for AI response');
                }
                
            } else if (conversationStatus === constants.CONVERSATION_STATUS.HUMAN) {
                console.log('� HUMAN mode active - AI context updated, no message sent to user');
                console.log('⏳ Waiting for LM to respond manually...');
                
                // AI has updated its context but does NOT reply
                // LM will handle the response manually via NOC dashboard
            }
            
        } catch (error) {
            console.error('❌ === AI RESPONSE ERROR ===');
            console.error('Error in AI response processing:', error);
            console.error('Error stack:', error.stack);
            console.error('❌ === END AI RESPONSE ERROR ===');
            
            // Send fallback message only in AI mode
            try {
                const user = await databaseService.userService.findUserByWhatsappId(messageObj.from);
                if (user?.conversationStatus === constants.CONVERSATION_STATUS.AI) {
                    const fallbackMessage = "I'm sorry, I'm having technical difficulties right now. Please try again in a moment!";
                    await whatsappService.sendMessage(messageObj.from, fallbackMessage);
                }
            } catch (fallbackError) {
                console.error('❌ Failed to send fallback message:', fallbackError);
            }
        }
    }
}

module.exports = MessageProcessor;
