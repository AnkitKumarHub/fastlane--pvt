# 📲 WhatsApp AI Bot - Complete Setup Guide

## 🎯 Overview
This WhatsApp bot integrates with the **Pinch Lifestyle Manager AI** to provide intelligent responses to user messages through WhatsApp Cloud API.

**Flow**: WhatsApp → Webhook → AI API → WhatsApp

## 🛠️ Setup Instructions

### 1. Environment Variables
1. Copy `.env.example` to `.env`
2. Fill in your WhatsApp Business API credentials:
   ```env
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
   WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here
   WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token_here
   PORT=3000
   
   # AI API Configuration
   AI_API_BASE_URL=https://platformbertsolutions-213643327387-asia-south1-run.app
   AI_API_ENDPOINT=/whatsapp
   AI_API_TIMEOUT=30000
   ```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 4. Webhook Configuration
1. Server will run on `http://localhost:3000`
2. Webhook endpoint: `http://localhost:3000/webhook`
3. Use a service like **ngrok** to expose your local server:
   ```bash
   ngrok http 3000
   ```
4. Configure the ngrok URL in Meta Developer Console

## 🔧 API Integrations

### WhatsApp Cloud API
- **Version**: v20.0
- **Webhook Events**: Messages
- **Send Message**: POST to Meta Graph API

### AI API (Pinch Lifestyle Manager)
- **URL**: Configurable via `AI_API_BASE_URL` (default: https://platformbertsolutions-213643327387-asia-south1-run.app)
- **Endpoint**: Configurable via `AI_API_ENDPOINT` (default: /whatsapp)
- **Method**: POST
- **Timeout**: Configurable via `AI_API_TIMEOUT` (default: 30000ms)
- **Response**: Streaming (SSE format)
- **Final Response**: Extracted from `response_complete` type

## 🚀 Features

### ✅ Implemented
- [x] Webhook verification for Meta
- [x] Receive WhatsApp messages
- [x] Process text messages
- [x] Forward messages to AI API
- [x] Handle AI streaming responses
- [x] Send AI responses back to WhatsApp
- [x] Error handling and fallbacks
- [x] Message logging and database placeholder
- [x] Phone number formatting
- [x] Non-text message acknowledgment

### 📋 Message Flow
1. **User sends message** → WhatsApp
2. **WhatsApp** → Webhook (POST /webhook)
3. **Webhook** → Message Processor
4. **Message Processor** → AI Service
5. **AI Service** → Pinch AI API (streaming response)
6. **AI Service** → Extract final content from stream
7. **WhatsApp Service** → Send response to user

## 📁 Project Structure
```
whatsappProject/
├── src/
│   ├── controllers/
│   │   └── webhookController.js    # Handle webhook requests
│   ├── routes/
│   │   └── webhookRoutes.js        # Define webhook routes
│   └── services/
│       ├── aiService.js            # 🆕 AI API integration
│       ├── messageProcessor.js     # Message handling logic
│       ├── whatsappService.js      # WhatsApp API calls
│       └── databaseService.js      # Database operations
├── server.js                       # Main server file
├── package.json
├── .env.example                    # Environment variables template
└── README.md
```

## 🧪 Testing

### Test Webhook Verification
```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=TEST_CHALLENGE"
```

### Test Message Processing
Send a WhatsApp message to your business number and check the console logs.

## 🔍 Debugging

### Console Logs
The application provides detailed logging:
- 🔄 Message processing steps
- 🤖 AI API requests/responses
- 📤 WhatsApp message sending
- ❌ Error handling

### Common Issues
1. **Webhook not verified**: Check `WEBHOOK_VERIFY_TOKEN`
2. **Messages not sending**: Verify `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`
3. **AI not responding**: Check network connectivity to AI API

## 🔐 Security Notes
- Keep your `.env` file secure and never commit it
- Use HTTPS in production (ngrok provides this)
- Validate all incoming webhook data

## 📞 Support
If you encounter issues:
1. Check console logs for detailed error information
2. Verify all environment variables are set correctly
3. Test each component individually (webhook → AI API → WhatsApp)

---
**Ready to deploy! 🚀**