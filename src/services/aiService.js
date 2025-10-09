const axios = require('axios');

class AIService {
    constructor() {
        // Use environment variables with fallbacks
        this.baseURL = process.env.AI_API_BASE_URL;
        this.endpoint = process.env.AI_API_ENDPOINT;
        this.timeout = parseInt(process.env.AI_API_TIMEOUT);
        
        // console.log('🔧 AI Service initialized:');
        // console.log(`   Base URL: ${this.baseURL}`);
        // console.log(`   Endpoint: ${this.endpoint}`);
        // console.log(`   Timeout: ${this.timeout}ms`);
    }
    
    /**
     * Send message to AI API and handle streaming response
     * @param {string} message - The user message
     * @param {string} phoneNumber - User's phone number
     * @returns {Promise<string>} - Complete AI response content
     */
    async sendMessageToAI(message, phoneNumber) {
        try {
            console.log('🤖 Sending message to AI API...');
            // console.log(`📞 Phone: ${phoneNumber}`);
            // console.log(`💬 Message: ${message}`);
            
            const requestBody = {
                message: message,
                phoneNumber: phoneNumber,
                isWhatsApp: true
            };
            
            // console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));
            
            const config = {
                method: 'POST',
                url: this.baseURL + this.endpoint,
                data: requestBody,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/plain, text/event-stream, */*'
                },
                responseType: 'stream', // Important for handling streaming response
                timeout: this.timeout // Use configurable timeout
            };
            
            console.log('🔄 Making AI API request:', config.url);
            // console.log('🔧 Request config:', {
            //     method: config.method,
            //     url: config.url,
            //     headers: config.headers,
            //     timeout: config.timeout
            // });
            
            const response = await axios(config);
            
            console.log('✅ AI API connection successful');
            // console.log('📊 Response status:', response.status);
            // console.log('📋 Response headers:', response.headers);
            
            // Process the streaming response
            const aiResponse = await this.processStreamingResponse(response.data);
            
            // console.log('✅ AI API response received');
            console.log('🔍 Full AI Response:', aiResponse);
            
            return aiResponse;
            
        } catch (error) {
            console.error('❌ === AI API ERROR ===');
            console.error('Error message:', error.message);
            console.error('Error code:', error.code);
            
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response statusText:', error.response.statusText);
                console.error('Response headers:', error.response.headers);
                
                // Try to read response data if available
                if (error.response.data) {
                    console.error('Response data:', error.response.data);
                }
            } else if (error.request) {
                console.error('Request made but no response received');
                console.error('Request details:', {
                    method: error.config?.method,
                    url: error.config?.url,
                    headers: error.config?.headers
                });
            }
            console.error('❌ === END AI API ERROR ===');
            
            // Return fallback message
            return "I'm sorry, I'm experiencing technical difficulties right now. Please try again in a moment.";
        }
    }
    
    /**
     * Process streaming response from AI API
     * @param {Stream} stream - Response stream from AI API
     * @returns {Promise<string>} - Complete response content
     */
    async processStreamingResponse(stream) {
        const streamTimeout = this.timeout - 5000; // 5 seconds less than request timeout
        
        return new Promise((resolve, reject) => {
            let completeResponse = '';
            let buffer = '';
            let chunks = [];
            
            console.log('Processing AI streaming response...');
            
            stream.on('data', (chunk) => {
                const chunkStr = chunk.toString();
                console.log('Raw chunk received:', chunkStr);
                
                buffer += chunkStr;
                
                // Process each line in the buffer
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                lines.forEach(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine && trimmedLine.startsWith('data:')) {
                        try {
                            // Extract JSON from "data:{json}" format
                            const jsonStr = trimmedLine.substring(5).trim();
                            
                            // Skip empty data lines
                            if (!jsonStr || jsonStr === '') {
                                return;
                            }
                            
                            const data = JSON.parse(jsonStr);
                            chunks.push(data);
                            
                            console.log('📦 Parsed chunk:', JSON.stringify(data, null, 2));
                            
                            // Handle different chunk types based on your screenshot
                            if (data.type === 'content_chunk') {
                                console.log('📝 Content chunk:', data.content);
                                // Collect content chunks but don't use them for final response
                            } else if (data.type === 'response_complete') {
                                // This is the final response with complete content
                                console.log('✅ Response complete received');
                                if (data.data && data.data.content) {
                                    completeResponse = data.data.content;
                                    console.log('📋 Complete response from data.data.content:', completeResponse);
                                } else if (data.content) {
                                    completeResponse = data.content;
                                    console.log('📋 Complete response from data.content:', completeResponse);
                                }
                            } else {
                                console.log(`ℹ️ Other chunk type: ${data.type}`, data);
                            }
                            
                        } catch (parseError) {
                            console.warn('⚠️ Failed to parse chunk as JSON:', trimmedLine);
                            console.warn('Parse error:', parseError.message);
                            
                            // Sometimes the response might be plain text
                            if (trimmedLine.includes('data:') && trimmedLine.length > 5) {
                                const textContent = trimmedLine.substring(5).trim();
                                if (textContent && !textContent.startsWith('{')) {
                                    console.log('📝 Plain text content:', textContent);
                                    completeResponse = textContent;
                                }
                            }
                        }
                    } else if (trimmedLine && !trimmedLine.startsWith('data:')) {
                        console.log('📄 Non-data line:', trimmedLine);
                    }
                });
            });
            
            stream.on('end', () => {
                console.log('🏁 Stream ended');
                console.log('📊 Total chunks processed:', chunks.length);
                console.log('📋 All chunks:', JSON.stringify(chunks, null, 2));
                
                if (completeResponse && completeResponse.trim()) {
                    console.log('✅ Using complete response:', completeResponse);
                    resolve(completeResponse.trim());
                } else {
                    console.warn('⚠️ No complete response found in chunks');
                    
                    // Fallback: try to concatenate content chunks
                    const contentChunks = chunks
                        .filter(chunk => chunk.type === 'content_chunk')
                        .map(chunk => chunk.content)
                        .join('');
                    
                    if (contentChunks) {
                        console.log('🔄 Using concatenated content chunks:', contentChunks);
                        resolve(contentChunks);
                    } else {
                        console.warn('⚠️ No usable content found, using fallback');
                        resolve("I received your message but couldn't generate a proper response. Please try again.");
                    }
                }
            });
            
            stream.on('error', (error) => {
                console.error('❌ Stream error:', error);
                reject(error);
            });
            
            // Timeout handling
            setTimeout(() => {
                console.warn('⏰ Stream timeout reached');
                if (completeResponse) {
                    resolve(completeResponse);
                } else {
                    resolve("Response timeout. Please try again.");
                }
            }, streamTimeout);
        });
    }
    
    /**
     * Clean phone number format for AI API
     * @param {string} phoneNumber - Raw phone number
     * @returns {string} - Formatted phone number
     */
    formatPhoneNumber(phoneNumber) {
        // console.log(`📱 Original phone number: ${phoneNumber}`);
        
        // Remove any non-digit characters
        let cleaned = phoneNumber.replace(/[^\d]/g, '');
        // console.log(`📱 After removing non-digits: ${cleaned}`);
        
        // For Indian numbers, we need only the last 10 digits
        if (cleaned.startsWith('91') && cleaned.length === 12) {
            // Remove the '91' country code, keep only last 10 digits
            cleaned = cleaned.substring(2);
            // console.log(`📱 Removed India country code (91): ${cleaned}`);
        } else if (cleaned.startsWith('1') && cleaned.length === 11) {
            // For US numbers, remove country code '1'
            cleaned = cleaned.substring(1);
            // console.log(`📱 Removed US country code (1): ${cleaned}`);
        } else if (cleaned.length > 10) {
            // For any other long numbers, take last 10 digits
            cleaned = cleaned.slice(-10);
            // console.log(`📱 Taking last 10 digits: ${cleaned}`);
        }
        
        // console.log(`📱 Final formatted phone: ${phoneNumber} → ${cleaned}`);
        return cleaned;
    }
}

module.exports = AIService;

// module.exports = AIService;