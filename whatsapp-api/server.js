const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');

const app = express();
app.use(express.json());
app.use(cors());

const logger = pino({ level: process.env.LOG_LEVEL || 'error' });
const API_KEY = process.env.API_KEY || 'your_super_secret_api_key_change_me_123456';
const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://n8n:5678/webhook/whatsapp-webhook';

let sock = null;
let qrCode = null;
let isConnected = false;
let lastDisconnectInfo = null;
let lastQrAt = null;


function getViewOnceImageMessage(msg) {
  const m = msg?.message;
  if (!m) return null;
  return (
    m.viewOnceMessage?.message?.imageMessage ||
    m.viewOnceMessageV2?.message?.imageMessage ||
    m.viewOnceMessageV2Extension?.message?.imageMessage ||
    null
  );
}

async function downloadImageBuffer(message, imageMessage) {
  // Try direct helper first (works for most Baileys versions)
  try {
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      { logger }
    );
    if (buffer) return buffer;
  } catch (error) {
    // fallback below
  }

  // Fallback: stream download
  const stream = await downloadContentFromMessage(imageMessage, 'image');
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks);
}
const dataDir = '/app/data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ============================================
// MIDDLEWARE: Verify API Key
// ============================================
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['apikey'] || req.query.apikey;
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

// ============================================
// INITIALIZE WHATSAPP
// ============================================
async function startWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('/app/.auth');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: logger,
      printQRInTerminal: true,
      browser: ['Chrome', '121.0.0', 'Linux'],
      shouldSyncHistoryMessage: () => false,
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode = qr;
        lastQrAt = Date.now();
        console.log('📱 QR Code generated! Scan to connect...');
      }

      if (connection === 'open') {
        isConnected = true;
        qrCode = null;
        console.log('✅ WhatsApp Connected!');
      } else if (connection === 'close') {
        isConnected = false;
        lastDisconnectInfo = lastDisconnect || null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        if (statusCode !== DisconnectReason.loggedOut) {
          console.log('⏳ Reconnecting...');
          setTimeout(() => startWhatsApp(), 3000);
        } else {
          console.log('❌ Logged out');
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
      try {
        try {
          console.log('messages.upsert event', { type: m?.type, count: m?.messages?.length || 0 });
        } catch (e) {}
        for (const message of m.messages) {
          if (!message.message) continue;
          if (message.key?.fromMe) continue;

          try {
            const keys = Object.keys(message.message || {});
            console.log('Incoming message', {
              from: message.key?.remoteJid,
              types: keys,
              hasViewOnce: Boolean(getViewOnceImageMessage(message))
            });
          } catch (e) {}

          // Auto-handle view-once images: download and resend to the same chat
          try {
            const voImage = getViewOnceImageMessage(message);
            if (voImage && sock) {
              const imgBuffer = await downloadImageBuffer(message, voImage);
              if (imgBuffer) {
                // Send back to the same chat
                await sock.sendMessage(
                  message.key.remoteJid,
                  { image: imgBuffer, caption: 'View-once image recovered' }
                );

                // Send to N8N webhook with base64 payload for saving
                const voPayload = {
                  from: message.key.remoteJid,
                  timestamp: message.messageTimestamp,
                  type: 'view_once',
                  message: {
                    from: message.key.remoteJid,
                    messageTimestamp: message.messageTimestamp,
                    mediaType: 'imageMessage',
                    isViewOnce: true,
                    mimetype: voImage.mimetype || 'image/jpeg',
                    fileLength: voImage.fileLength || null,
                    caption: voImage.caption || null,
                    base64: imgBuffer.toString('base64')
                  }
                };

                try {
                  await axios.post(N8N_WEBHOOK_URL, voPayload);
                  console.log('?? View-once image sent to N8N');
                } catch (error) {
                  console.error('? Webhook error (view-once):', error.message);
                }
              }
            }
          } catch (error) {
            console.error('View-once handling error:', error.message);
          }

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

          // Handle images
          if (message.message.imageMessage) {
            messageData.message.mediaType = 'imageMessage';
            messageData.message.mimetype = message.message.imageMessage.mimetype;
            messageData.message.fileLength = message.message.imageMessage.fileLength;

            try {
              await axios.post(N8N_WEBHOOK_URL, messageData);
              console.log('📤 Image sent to N8N');
            } catch (error) {
              console.error('❌ Webhook error:', error.message);
            }
          }

          // Handle text
          if (message.message.conversation || message.message.extendedTextMessage) {
            const text = message.message.conversation || message.message.extendedTextMessage?.text;
            messageData.message.mediaType = 'textMessage';
            messageData.message.text = text;

            try {
              await axios.post(N8N_WEBHOOK_URL, messageData);
              console.log('📤 Text sent to N8N');
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
    console.error('❌ Error:', error.message);
    setTimeout(() => startWhatsApp(), 5000);
  }
}

// ============================================
// API ENDPOINTS
// ============================================

function registerApiRoutes(prefix) {
  const withPrefix = (route) => (prefix ? `${prefix}${route}` : route);

  // Health check (no auth required)
  app.get(withPrefix('/health'), (req, res) => {
    res.json({ ok: true, connected: isConnected });
  });

  // Status
  app.get(withPrefix('/status'), verifyApiKey, (req, res) => {
    res.json({
      connected: isConnected,
      hasQR: !!qrCode,
      lastQrAt,
      message: isConnected ? 'Connected' : 'Waiting for QR scan'
    });
  });

  // Get QR Code
  app.get(withPrefix('/qr'), verifyApiKey, (req, res) => {
    if (!qrCode) {
      return res.status(400).json({ error: 'No QR code available' });
    }
    res.json({ qrCode });
  });

  // Get QR Code as data URL (for browser display)
  app.get(withPrefix('/qr-image'), verifyApiKey, async (req, res) => {
    if (!qrCode) {
      return res.status(400).json({ error: 'No QR code available' });
    }
    try {
      const dataUrl = await qrcode.toDataURL(qrCode);
      res.json({ dataUrl });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get QR Code as PNG image (directly scannable)
  app.get(withPrefix('/qr.png'), verifyApiKey, async (req, res) => {
    if (!qrCode) {
      return res.status(400).json({ error: 'No QR code available' });
    }
    try {
      const pngBuffer = await qrcode.toBuffer(qrCode);
      const outPath = path.join('/app/data', 'qr.png');
      fs.writeFileSync(outPath, pngBuffer);
      res.type('png').send(pngBuffer);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Pairing code (alternative to QR)
  app.post(withPrefix('/pair'), verifyApiKey, async (req, res) => {
    try {
      const phone = req.body?.phone || req.query?.phone;
      if (!phone) {
        return res.status(400).json({ error: 'Missing phone number' });
      }
      if (!sock || typeof sock.requestPairingCode !== 'function') {
        return res.status(400).json({ error: 'Pairing not available yet' });
      }
      const code = await sock.requestPairingCode(phone);
      res.json({ code });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Debug info
  app.get(withPrefix('/debug'), verifyApiKey, (req, res) => {
    res.json({
      connected: isConnected,
      hasQR: !!qrCode,
      lastQrAt,
      lastDisconnectInfo
    });
  });

  // Force restart WA socket
  app.post(withPrefix('/restart'), verifyApiKey, async (req, res) => {
    try {
      if (sock && sock.end) {
        sock.end();
      }
      sock = null;
      qrCode = null;
      isConnected = false;
      lastDisconnectInfo = null;
      lastQrAt = null;
      startWhatsApp();
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get instance info
  app.get(withPrefix('/info'), verifyApiKey, (req, res) => {
    res.json({
      connected: isConnected,
      qrAvailable: !!qrCode,
      lastQrAt
    });
  });

  // Send message
  app.post(withPrefix('/send-message'), verifyApiKey, async (req, res) => {
    try {
      if (!isConnected) {
        return res.status(400).json({ error: 'Not connected. Scan QR code first.' });
      }

      const { number, text } = req.body;
      if (!number || !text) {
        return res.status(400).json({ error: 'Missing number or text' });
      }

      const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text });

      res.json({ success: true, message: 'Message sent' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// Register both /api/* and legacy root routes
registerApiRoutes('/api');
registerApiRoutes('');

// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, async () => {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('🚀 WhatsApp API Server');
  console.log('═══════════════════════════════════════════════');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /api/health');
  console.log('  GET  /api/status');
  console.log('  GET  /api/qr');
  console.log('  POST /api/send-message');
  console.log('');
  console.log('All endpoints (except /health) require:');
  console.log('  Header: apikey: ' + API_KEY.substring(0, 10) + '...');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  await startWhatsApp();
});

module.exports = app;
