const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());
app.use(cors());

const logger = pino({ level: process.env.LOG_LEVEL || 'error' });
const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://n8n:5678/webhook/whatsapp-webhook';

let sock = null;
let qrCode = null;
let isConnected = false;
let lastQRTime = 0;

const photoDir = '/app/photos';
if (!fs.existsSync(photoDir)) {
  fs.mkdirSync(photoDir, { recursive: true });
}

async function startWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('/app/.auth');

    sock = makeWASocket({
      auth: state,
      logger: logger,
      printQRInTerminal: true,
      browser: ['Ubuntu', 'Chrome', '121.0.0'],
      generateHighQualityLinkPreview: true,
      shouldSyncHistoryMessage: () => false,
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode = qr;
        lastQRTime = Date.now();
        console.log('📱 QR Code generated!');
        console.log('⏰ QR expires in 60 seconds');
      }

      if (connection === 'open') {
        isConnected = true;
        qrCode = null;
        console.log('✅ WhatsApp Connected Successfully!');
      } else if (connection === 'close') {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        if (statusCode === DisconnectReason.loggedOut) {
          console.log('❌ Device logged out');
          fs.rmSync('/app/.auth', { recursive: true, force: true });
        } else if (statusCode === DisconnectReason.connectionClosed) {
          console.log('⏳ Connection closed, reconnecting...');
          setTimeout(() => startWhatsApp(), 3000);
        } else if (statusCode === DisconnectReason.connectionLost) {
          console.log('⏳ Connection lost, reconnecting...');
          setTimeout(() => startWhatsApp(), 3000);
        } else if (statusCode === DisconnectReason.connectionReplaced) {
          console.log('ℹ️ Connection replaced, restarting...');
          sock.end();
          setTimeout(() => startWhatsApp(), 3000);
        } else if (statusCode === DisconnectReason.timedOut) {
          console.log('⏳ Connection timed out, reconnecting...');
          setTimeout(() => startWhatsApp(), 3000);
        } else {
          console.log('⏳ Unknown disconnect, reconnecting...');
          setTimeout(() => startWhatsApp(), 3000);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
      try {
        for (const message of m.messages) {
          if (!message.message) continue;

          const messageData = {
            from: message.key.remoteJid,
            timestamp: message.messageTimestamp,
            type: 'messages',
            message: {
              from: message.key.remoteJid,
              messageTimestamp: message.messageTimestamp,
              mediaType: null,
              text: null
            }
          };

          // Handle image messages
          if (message.message.imageMessage) {
            messageData.message.mediaType = 'imageMessage';
            messageData.message.mimetype = message.message.imageMessage.mimetype;
            messageData.message.fileLength = message.message.imageMessage.fileLength;
            messageData.message.caption = message.message.imageMessage.caption || '';

            try {
              await axios.post(N8N_WEBHOOK_URL, messageData, { timeout: 10000 });
              console.log('📤 Image message sent to N8N');
            } catch (error) {
              console.error('❌ Webhook error:', error.message);
            }
          }

          // Handle text messages
          if (message.message.conversation || message.message.extendedTextMessage) {
            const text = message.message.conversation || message.message.extendedTextMessage?.text;
            messageData.message.mediaType = 'textMessage';
            messageData.message.text = text;

            try {
              await axios.post(N8N_WEBHOOK_URL, messageData, { timeout: 10000 });
              console.log('📤 Text message sent to N8N');
            } catch (error) {
              console.error('❌ Webhook error:', error.message);
            }
          }
        }
      } catch (error) {
        console.error('Error handling messages:', error.message);
      }
    });

  } catch (error) {
    console.error('❌ Error starting WhatsApp:', error.message);
    setTimeout(() => startWhatsApp(), 5000);
  }
}

// Routes
app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    hasQR: !!qrCode,
    message: isConnected ? '✅ WhatsApp connected' : '⏳ WhatsApp disconnected (scan QR to connect)',
    qrExpired: qrCode ? (Date.now() - lastQRTime > 60000) : null
  });
});

app.get('/qr', (req, res) => {
  if (!qrCode) {
    return res.status(400).json({ 
      error: 'No QR code available',
      message: 'Waiting for QR generation... Check /status again in 5 seconds'
    });
  }
  
  if (Date.now() - lastQRTime > 60000) {
    qrCode = null;
    return res.status(400).json({ error: 'QR code expired. Refresh page to generate new one.' });
  }

  res.json({ qrCode, expiresIn: 60000 - (Date.now() - lastQRTime) });
});

app.get('/qr-image', async (req, res) => {
  if (!qrCode) {
    return res.status(400).json({ error: 'No QR code available' });
  }

  try {
    const qrImage = await QRCode.toDataURL(qrCode);
    res.json({ qrImage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/send-message', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(400).json({ error: 'WhatsApp not connected' });
    }

    const { number, message } = req.body;
    if (!number || !message) {
      return res.status(400).json({ error: 'Missing number or message' });
    }

    const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });

    res.json({ success: true, message: 'Message sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/auth-info', (req, res) => {
  const authPath = '/app/.auth';
  const hasAuth = fs.existsSync(authPath) && fs.readdirSync(authPath).length > 0;
  res.json({ authenticated: hasAuth, connected: isConnected });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, connected: isConnected });
});

// Start server
const server = app.listen(PORT, async () => {
  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('🚀 WhatsApp API Server');
  console.log('════════════════════════════════════════════════════════');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔗 Webhook: ${N8N_WEBHOOK_URL}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /health     - Health check');
  console.log('  GET  /status     - Connection status');
  console.log('  GET  /qr         - QR code (text)');
  console.log('  GET  /qr-image   - QR code (image)');
  console.log('  POST /send-message - Send message');
  console.log('════════════════════════════════════════════════════════');
  console.log('');
  console.log('⏳ Initializing WhatsApp connection...');
  console.log('');
  
  await startWhatsApp();
});

module.exports = app;
