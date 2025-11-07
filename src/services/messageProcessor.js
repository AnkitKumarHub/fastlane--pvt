const whatsappService = require('./whatsappService');
const whatsappStatusService = require('./whatsappStatusService');
const databaseService = require('./databaseService');
const MediaProcessor = require('./mediaProcessor');
const LocationService = require('./locationService');
const aiService = require('./aiService');
const ReactionService = require('./reactionService');
const constants = require('../utils/constants');

class MessageProcessor {
    
    constructor() {
        this.aiService = aiService;
    }
    
    static async processIncomingMessage(messageData) {
        console.log('🚨 === MESSAGE PROCESSOR STARTED ===');
        // console.log('🔄 Processing incoming message...');
        // console.log('📦 Message data received:', JSON.stringify(messageData, null, 2));
        
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
                
                // ✅ STEP 1: IMMEDIATELY mark message as read and show typing indicator
                // This provides instant user feedback before any processing
                try {
                    console.log('🔵 Marking message as read and showing typing indicator...');
                    const statusResult = await whatsappStatusService.markMessageAsReadAndShowTyping(
                        message.id, 
                        message.from
                    );
                    
                    if (statusResult.success) {
                        console.log('✅ Combined operation successful - Read status + Typing indicator');
                    } else {
                        console.log('❌ Combined operation failed');
                    }
                } catch (statusError) {
                    console.error('❌ Status operations failed:', statusError.message);
                    console.log('🔄 Continuing with message processing despite status failure...');
                }
                
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
                        
                        // Process image media with new MediaProcessor
                        try {
                            // console.log('📥 Processing image media...');
                            const downloadedMedia = await whatsappService.downloadMedia(message.image.id);
                            
                            // Use new MediaProcessor
                            mediaData = await MediaProcessor.processMedia(
                                messageObj,
                                downloadedMedia,
                                'inbound'
                            );
                            
                            // Store media info in message object
                            messageObj.media = {
                                type: mediaData.type,
                                url: mediaData.url,
                                storagePath: mediaData.storagePath,  // NEW: Include storage path
                                mimeType: mediaData.mimeType,
                                fileName: mediaData.fileName,
                                fileSize: mediaData.fileSize,
                                metadata: mediaData.metadata
                            };
                            
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
                        
                        // Process audio media with new MediaProcessor
                        try {
                            // console.log('📥 Processing audio media...');
                            const downloadedMedia = await whatsappService.downloadMedia(message.audio.id);
                            
                            // Use new MediaProcessor
                            mediaData = await MediaProcessor.processMedia(
                                messageObj,
                                downloadedMedia,
                                'inbound'
                            );
                            
                            // Store media info in message object
                            messageObj.media = {
                                type: mediaData.type,
                                url: mediaData.url,
                                storagePath: mediaData.storagePath,  // NEW: Include storage path
                                mimeType: mediaData.mimeType,
                                fileName: mediaData.fileName,
                                fileSize: mediaData.fileSize,
                                metadata: mediaData.metadata
                            };
                            
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
                        
                        // Process document media with new MediaProcessor
                        try {
                            // console.log('📥 Processing document media...');
                            const downloadedMedia = await whatsappService.downloadMedia(message.document.id);
                            
                            // Use original filename if available
                            if (message.document.filename) {
                                downloadedMedia.filename = message.document.filename;
                            }
                            
                            // Use new MediaProcessor
                            mediaData = await MediaProcessor.processMedia(
                                messageObj,
                                downloadedMedia,
                                'inbound'
                            );
                            
                            // Store media info in message object
                            messageObj.media = {
                                type: mediaData.type,
                                url: mediaData.url,
                                storagePath: mediaData.storagePath,  // NEW: Include storage path
                                mimeType: mediaData.mimeType,
                                fileName: mediaData.fileName,
                                fileSize: mediaData.fileSize,
                                metadata: mediaData.metadata
                            };
                            
                            // console.log('✅ Document media processed successfully:', mediaData.url);
                        } catch (error) {
                            console.error('❌ Document media processing failed:', error.message);
                            mediaProcessingError = error.message;
                        }
                        break;
                        
                    case 'video':
                        messageObj.content = {
                            mediaId: message.video?.id,
                            mimeType: message.video?.mime_type,
                            caption: message.video?.caption || ''
                        };
                        // console.log('🎥 Video message content:', messageObj.content);
                        
                        // Process video media with new MediaProcessor
                        try {
                            // console.log('📥 Processing video media...');
                            const downloadedMedia = await whatsappService.downloadMedia(message.video.id);
                            
                            // Use new MediaProcessor
                            mediaData = await MediaProcessor.processMedia(
                                messageObj,
                                downloadedMedia,
                                'inbound'
                            );
                            
                            // Store media info in message object
                            messageObj.media = {
                                type: mediaData.type,
                                url: mediaData.url,
                                storagePath: mediaData.storagePath,  // NEW: Include storage path
                                mimeType: mediaData.mimeType,
                                fileName: mediaData.fileName,
                                fileSize: mediaData.fileSize,
                                metadata: mediaData.metadata
                            };
                            
                            // console.log('✅ Video media processed successfully:', mediaData.url);
                        } catch (error) {
                            console.error('❌ Video media processing failed:', error.message);
                            mediaProcessingError = error.message;
                        }
                        break;
                        
                    case 'voice':
                        messageObj.content = {
                            mediaId: message.voice?.id,
                            mimeType: message.voice?.mime_type
                        };
                        // console.log('🎤 Voice message content:', messageObj.content);
                        
                        // Process voice media with new MediaProcessor
                        try {
                            // console.log('📥 Processing voice media...');
                            const downloadedMedia = await whatsappService.downloadMedia(message.voice.id);
                            
                            // Use new MediaProcessor
                            mediaData = await MediaProcessor.processMedia(
                                messageObj,
                                downloadedMedia,
                                'inbound'
                            );
                            
                            // Store media info in message object
                            messageObj.media = {
                                type: mediaData.type,
                                url: mediaData.url,
                                storagePath: mediaData.storagePath,  // NEW: Include storage path
                                mimeType: mediaData.mimeType,
                                fileName: mediaData.fileName,
                                fileSize: mediaData.fileSize,
                                metadata: mediaData.metadata
                            };
                            
                            // console.log('✅ Voice media processed successfully:', mediaData.url);
                        } catch (error) {
                            console.error('❌ Voice media processing failed:', error.message);
                            mediaProcessingError = error.message;
                        }
                        break;
                        
                    case 'sticker':
                        messageObj.content = {
                            mediaId: message.sticker?.id,
                            mimeType: message.sticker?.mime_type
                        };
                        // console.log('😄 Sticker message content:', messageObj.content);
                        
                        // Process sticker media with new MediaProcessor
                        try {
                            // console.log('📥 Processing sticker media...');
                            const downloadedMedia = await whatsappService.downloadMedia(message.sticker.id);
                            
                            // Use new MediaProcessor
                            mediaData = await MediaProcessor.processMedia(
                                messageObj,
                                downloadedMedia,
                                'inbound'
                            );
                            
                            // Store media info in message object
                            messageObj.media = {
                                type: mediaData.type,
                                url: mediaData.url,
                                storagePath: mediaData.storagePath,  // NEW: Include storage path
                                mimeType: mediaData.mimeType,
                                fileName: mediaData.fileName,
                                fileSize: mediaData.fileSize,
                                metadata: mediaData.metadata
                            };
                            
                            // console.log('✅ Sticker media processed successfully:', mediaData.url);
                        } catch (error) {
                            console.error('❌ Sticker media processing failed:', error.message);
                            mediaProcessingError = error.message;
                        }
                        break;
                        
                    case 'location':
                        messageObj.content = {
                            latitude: message.location?.latitude,
                            longitude: message.location?.longitude,
                            name: message.location?.name,
                            address: message.location?.address
                        };
                        // console.log('📍 Location message content:', messageObj.content);
                        
                        // Process location data with LocationService (bypass media validation)
                        try {
                            // console.log('📥 Processing location data...');
                            
                            // Use LocationService for location processing (no media validation)
                            mediaData = await LocationService.processLocation(
                                messageObj,
                                messageObj.content,
                                'inbound'
                            );
                            
                            // Store location info in message object with proper file information
                            messageObj.media = {
                                type: mediaData.type,
                                url: mediaData.thumbnailUrl || null,
                                storagePath: mediaData.thumbnailPath || null,
                                mimeType: mediaData.mimeType || null,
                                fileName: mediaData.fileName || null,
                                fileSize: mediaData.fileSize || 0,
                                metadata: mediaData.metadata
                            };
                            
                            // console.log('✅ Location data processed successfully');
                        } catch (error) {
                            console.error('❌ Location processing failed:', error.message);
                            mediaProcessingError = error.message;
                        }
                        break;
                        
                    case 'contacts':
                        messageObj.content = {
                            contacts: message.contacts
                        };
                        // console.log('👥 Contact message content:', messageObj.content);
                        
                        // Process contact data with new MediaProcessor
                        try {
                            // console.log('📥 Processing contact data...');
                            
                            // Process each contact
                            const contactsData = [];
                            for (const contact of message.contacts) {
                                const contactResult = await MediaProcessor.processMedia(
                                    messageObj,
                                    contact,
                                    'inbound'
                                );
                                contactsData.push(contactResult);
                            }
                            
                            // Store contacts info in message object
                            messageObj.media = {
                                type: constants.MEDIA_TYPES.CONTACT,
                                url: null, // Contacts don't have URL
                                storagePath: null, // Contacts don't need storage
                                mimeType: 'text/vcard',
                                fileName: null,
                                fileSize: 0,
                                metadata: {
                                    contacts: contactsData.map(c => c.metadata)
                                }
                            };
                            
                            // console.log('✅ Contact data processed successfully');
                        } catch (error) {
                            console.error('❌ Contact processing failed:', error.message);
                            mediaProcessingError = error.message;
                        }
                        break;
                        
                    case 'reaction':
                        console.log('🎯 Reaction message detected, processing...');
                        // Process reaction using ReactionService
                        try {
                            await ReactionService.processReaction(message);
                            console.log('✅ Reaction processed successfully');
                        } catch (error) {
                            console.error('❌ Reaction processing failed:', error.message);
                        }
                        
                        // Return early for reactions - no need to store as regular message
                        console.log('🚨 === REACTION PROCESSING COMPLETE ===\n');
                        return;
                        
                    default:
                        messageObj.content = { raw: message };
                        // console.log('❓ Unknown message type, storing raw:', messageObj.content);
                }
                
                // console.log('📝 Final message details:', JSON.stringify(messageObj, null, 2));
                
                // PHASE 1: Check if user exists BEFORE storing anything
                const whatsappId = messageObj.from;
                const userExists = await databaseService.userService.findUserByWhatsappId(whatsappId);
                const isNewUser = !userExists;
                
                // console.log('🔍 DEBUG - User existence check:', {
                //     whatsappId,
                //     userExists: !!userExists,
                //     isNewUser,
                //     decision: isNewUser ? 'WELCOME' : 'AI'
                // });
                
                // Store message in database using existing processIncomingMessage method
                // console.log('💾 Storing message in database...');
                let result = null;
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
                        case 'video':
                            if (mediaProcessingError) {
                                textContent = `[VIDEO] ${messageObj.content?.caption || 'Video'} - Processing failed: ${mediaProcessingError}`;
                            } else {
                                textContent = `[VIDEO] ${messageObj.content?.caption || 'Video'}`;
                            }
                            break;
                        case 'voice':
                            if (mediaProcessingError) {
                                textContent = '[VOICE] Voice note - Processing failed: ' + mediaProcessingError;
                            } else {
                                textContent = '[VOICE] Voice note';
                            }
                            break;
                        case 'document':
                            if (mediaProcessingError) {
                                textContent = `[DOCUMENT] ${messageObj.content?.filename || 'File'} - Processing failed: ${mediaProcessingError}`;
                            } else {
                                textContent = `[DOCUMENT] ${messageObj.content?.filename || 'File'}`;
                            }
                            break;
                        case 'sticker':
                            if (mediaProcessingError) {
                                textContent = '[STICKER] Sticker - Processing failed: ' + mediaProcessingError;
                            } else {
                                textContent = '[STICKER] Sticker';
                            }
                            break;
                        case 'location':
                            if (mediaProcessingError) {
                                textContent = '[LOCATION] Location - Processing failed: ' + mediaProcessingError;
                            } else {
                                const locationName = messageObj.content?.name || 'Location';
                                textContent = `[LOCATION] ${locationName}`;
                            }
                            break;
                        case 'contacts':
                            if (mediaProcessingError) {
                                textContent = '[CONTACT] Contact - Processing failed: ' + mediaProcessingError;
                            } else {
                                const contactCount = messageObj.content?.contacts?.length || 1;
                                textContent = `[CONTACT] ${contactCount} contact${contactCount > 1 ? 's' : ''}`;
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
                    
                    // Add enhanced media information if processing was successful
                    if (messageObj.media) {
                        messageData.mediaUrl = messageObj.media.url;
                        messageData.mediaType = messageObj.media.type;
                        messageData.mimeType = messageObj.media.mimeType;
                        messageData.fileName = messageObj.media.fileName;
                        messageData.fileSize = messageObj.media.fileSize;
                        
                        // NEW: Add storage path to Firestore
                        if (messageObj.media.storagePath) {
                            messageData.storagePath = messageObj.media.storagePath;
                            // console.log('🔍 DEBUG: storagePath added to messageData:', messageData.storagePath);
                        } else {
                            console.log('⚠️ DEBUG: messageObj.media.storagePath is missing or null');
                        }
                        
                        // Add metadata if available
                        if (messageObj.media.metadata) {
                            messageData.mediaMetadata = messageObj.media.metadata;
                        }
                        
                        // console.log('📎 Enhanced media information added to database:', {
                        //     url: messageObj.media.url,
                        //     type: messageObj.media.type,
                        //     storagePath: messageObj.media.storagePath,
                        //     mimeType: messageObj.media.mimeType,
                        //     messageDataStoragePath: messageData.storagePath // NEW: Debug log
                        // });
                        
                        // console.log('🔍 DEBUG: Full messageData being sent to database:', JSON.stringify(messageData, null, 2));
                    }
                    
                    result = await databaseService.processIncomingMessage(whatsappId, messageData);
                    // console.log('✅ Message stored successfully:', {
                    //     user: result.user.whatsappId,
                    //     totalMessages: result.user.totalMessageCount,
                    //     processingTime: result.processingTimeMs + 'ms',
                    //     isNewUser: result.isNewlyCreated
                    // });
                    
                    // DEBUG: Confirm result is set correctly
                    // console.log('🔍 DEBUG - Result assignment check:', {
                    //     resultExists: !!result,
                    //     isNewlyCreated: result?.isNewlyCreated,
                    //     resultType: typeof result
                    // });
                } catch (dbError) {
                    console.error('❌ Database storage failed:', dbError.message);
                    // console.log('🔍 DEBUG - Database error, result state:', {
                    //     resultExists: !!result,
                    //     errorType: dbError.constructor.name
                    // });
                    // Continue processing even if DB fails
                }
                
                // Process ALL text messages - use PRE-CHECKED user existence flag
                if (messageObj.type === 'text' && messageObj.content.text.trim()) {
                    // DEBUG: Log decision making process using PRE-CHECKED flag
                    // console.log('🔍 DEBUG - Text processing decision (using pre-checked flag):', {
                    //     hasResult: !!result,
                    //     isNewUser: isNewUser,  // Use pre-checked flag, not result
                    //     messageType: messageObj.type,
                    //     textContent: messageObj.content?.text?.substring(0, 50) + '...',
                    //     whatsappId: messageObj.from
                    // });
                    
                    try {
                        if (isNewUser) {
                            // console.log('🆕 New user detected (pre-checked), sending welcome message...');
                            await processor.processWelcomeResponse(messageObj);
                        } else {
                            // console.log('🤖 Existing user (pre-checked), triggering AI processing for text message...');
                            await processor.processAIResponse(messageObj);
                        }
                        console.log('✅ Message processing completed');
                    } catch (processingError) {
                        console.error('❌ Message processing failed:', processingError.message);
                        // Fallback to AI if there's any error
                        await processor.processAIResponse(messageObj);
                    }
                } else if (messageObj.type !== 'text') {
                    // console.log(`📎 Non-text message received (${messageObj.type}), sending acknowledgment...`);
                    
                    let acknowledgmentText;
                    switch (messageObj.type) {
                        case 'image':
                            acknowledgmentText = "Processing media shared by you";
                            break;
                        case 'video':
                            acknowledgmentText = "Processing media shared by you";
                            break;
                        case 'audio':
                        case 'voice':
                            acknowledgmentText = "Processing media shared by you";
                            break;
                        case 'document':
                            acknowledgmentText = "Processing media shared by you";
                            break;
                        case 'sticker':
                            acknowledgmentText = "Processing media shared by you";
                            break;
                        case 'location':
                            acknowledgmentText = "Processing media shared by you";
                            break;
                        case 'contacts':
                            acknowledgmentText = "Processing media shared by you";
                            break;
                        default:
                            acknowledgmentText = "Processing media shared by you";
                    }
                    
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
    
    async processWelcomeResponse(messageObj) {
        try {
            console.log('👋 === WELCOME MESSAGE PROCESSING STARTED ===');
            // console.log('🆕 Sending welcome message to new user...');
            
            const welcomeMessage = constants.WELCOME_MESSAGE.TEXT;
            const whatsappResponse = await whatsappService.sendMessage(messageObj.from, welcomeMessage);
            
            console.log('✅ Welcome message sent via WhatsApp');
            
            // Store welcome message in database
            if (whatsappResponse && whatsappResponse.messages && whatsappResponse.messages[0]) {
                const welcomeMessageData = {
                    whatsappMessageId: whatsappResponse.messages[0].id,
                    textContent: welcomeMessage,
                    timestamp: new Date()
                };
                
                const auditData = {
                    checkpointId: `welcome_${Date.now()}`,
                    processingTimeMs: 100
                };
                
                await databaseService.processOutgoingAiMessage(
                    messageObj.from,
                    welcomeMessageData,
                    auditData
                );
                
                // console.log('✅ Welcome message stored in database successfully');
            } else {
                console.error('⚠️ No message ID received from WhatsApp API for welcome message');
            }
            
            console.log('👋 === WELCOME MESSAGE PROCESSING COMPLETE ===');
            
        } catch (error) {
            console.warn('⚠️ Welcome message failed, falling back to AI:', error.message);
            console.error('Welcome message error details:', error);
            
            // Fallback to AI response
            await this.processAIResponse(messageObj);
        }
    }
    
    async processAIResponse(messageObj) {
        try {
            console.log('🚨 === AI RESPONSE PROCESSING STARTED ===');
            
            const whatsappId = messageObj.from;
            
            // ✅ Check conversation status BEFORE processing
            const user = await databaseService.userService.findUserByWhatsappId(whatsappId);
            const conversationStatus = user?.conversationStatus || constants.CONVERSATION_STATUS.AI;
            
            // console.log('📊 Conversation Status:', conversationStatus);
            // if (user?.assignedLmId) {
            //     console.log('👤 Assigned LM:', user.assignedLmId);
            // }
            
            // Format phone number and get AI response
            const formattedPhone = this.aiService.formatPhoneNumber(whatsappId);
            
            // ✅ Pass conversationStatus and direction as parameters
            const aiResponse = await this.aiService.sendMessageToAI(
                messageObj.content.text,
                formattedPhone,
                conversationStatus,
                constants.MESSAGE_DIRECTION.INBOUND  // User message direction
            );
            
            // console.log('✅ AI service returned response');
            console.log('🎯 AI Response ready:', aiResponse);
            
            // ✅ Only send message to user if status is AI
            if (conversationStatus === constants.CONVERSATION_STATUS.AI) {
                console.log('📤 Sending AI response to WhatsApp (AI mode)...');
                
                const whatsappResponse = await whatsappService.sendMessage(messageObj.from, aiResponse);
                
                // Store AI response in database
                if (whatsappResponse && whatsappResponse.messages && whatsappResponse.messages[0]) {
                    const aiMessageId = whatsappResponse.messages[0].id;
                    // console.log('💾 Storing AI response in database...');
                    
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
                // console.log('⏳ Waiting for LM to respond manually...');
                
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
