# 🚀 N8N + WhatsApp Integration Project

Status: **✅ READY TO USE** - Semua container sudah running!

## 📦 What's Included

```
n8n-project/
├── docker-compose.yml              # N8N + WhatsApp API + PostgreSQL
├── Dockerfile                       # Custom N8N image (optional)
├── whatsapp-api/
│   ├── Dockerfile                  # WhatsApp API container
│   ├── package.json               # Node dependencies
│   └── server.js                  # WhatsApp server (Baileys library)
├── workflows/
│   └── whatsapp-view-once-workflow.json  # Template workflow
├── INTEGRATION_GUIDE.md            # 📖 Complete setup guide
├── WHATSAPP_SETUP.md              # Manual setup details
├── setup-whatsapp.sh              # Auto setup script (Linux/Mac)
├── setup-whatsapp.bat             # Auto setup script (Windows)
└── photos/                         # Output folder untuk captured photos
```

## 🎯 Quick Start (3 Steps)

### 1️⃣ All containers are running
```bash
cd n8n-project
docker compose ps  # Check status
```

Expected output - 3 containers healthy:
```
NAME           STATUS                   PORTS
n8n-app        Up (health: starting)    0.0.0.0:5678->5678/tcp
whatsapp-api   Up (health: starting)    0.0.0.0:3000->3000/tcp
n8n-postgres   Up (healthy)             0.0.0.0:5432->5432/tcp
```

### 2️⃣ Link WhatsApp
```bash
# Get QR Code
curl http://localhost:3000/qr

# Scan dengan WhatsApp di HP:
# Settings → Linked Devices → Link Device → Scan QR

# Verify connection
curl http://localhost:3000/status
```

Expected: `{"connected": true}`

### 3️⃣ Setup N8N Workflow
- Open: http://localhost:5678
- Import: `workflows/whatsapp-view-once-workflow.json`
- Click: "Activate"
- Send View Once photo dari WhatsApp → Done! ✅

---

## 📖 Full Documentation

👉 **Read the complete guide:** [`INTEGRATION_GUIDE.md`](./INTEGRATION_GUIDE.md)

This covers:
- Step-by-step WhatsApp linking
- N8N workflow configuration
- Testing & troubleshooting
- Architecture & data flow
- Advanced customization

---

## 🌐 Access Services

| Service | URL | Purpose |
|---------|-----|---------|
| **N8N UI** | http://localhost:5678 | Automation platform |
| **WhatsApp API** | http://localhost:3000 | WhatsApp bridge |
| **WhatsApp Status** | http://localhost:3000/status | Connection check |
| **WhatsApp QR** | http://localhost:3000/qr | Get QR code |
| **Database** | localhost:5432 | PostgreSQL (internal) |

---

## 🎬 How It Works

1. **WhatsApp App** sends a View Once photo
2. **WhatsApp API** (Baileys) receives it via linked device
3. **Webhook** triggers N8N workflow
4. **N8N** processes the image:
   - Extracts media data
   - Saves to disk
   - Sends confirmation back to WhatsApp
5. **Photo** stored in `./photos/` folder

---

## 📝 Useful Commands

```bash
# Stop all services
docker compose down

# Start services
docker compose up -d

# View logs
docker logs whatsapp-api      # WhatsApp connection logs
docker logs n8n-app           # N8N workflow logs
docker logs n8n-postgres      # Database logs

# Check WhatsApp status
curl http://localhost:3000/status

# List saved photos
docker exec n8n-app ls -la /home/node/.n8n/photos/

# Clean restart
docker compose down
docker compose up -d
```

---

## 🔧 Troubleshooting Quick Links

| Problem | Solution |
|---------|----------|
| WhatsApp not connecting | → Check [`INTEGRATION_GUIDE.md`](./INTEGRATION_GUIDE.md#-troubleshooting) - WhatsApp tidak connect |
| Webhook not receiving data | → Verify workflow is Activated in N8N |
| Photos not saving | → Check permissions: `docker exec n8n-app mkdir -p /home/node/.n8n/photos/` |
| Can't access N8N | → Wait 30-60s for startup, then http://localhost:5678 |

---

## 📚 Architecture

```
┌──────────────────┐
│  Your Smartphone │
│   (WhatsApp)     │
└────────┬─────────┘
         │ Send View Once Photo
         ▼
┌──────────────────────────────┐
│    WhatsApp API (Port 3000)  │ ← Linked device
│  - Uses Baileys library      │
│  - Sends webhooks to N8N     │
└────────┬─────────────────────┘
         │ HTTP Webhook
         ▼
┌──────────────────────────────┐
│   N8N Workflow (Port 5678)   │
│  - Receive via webhook       │
│  - Filter media              │
│  - Extract/process           │
│  - Save file                 │
│  - Reply confirmation        │
└────────┬─────────────────────┘
         │ Save
         ▼
    📁 Photos Folder
```

---

## 🚀 What's Next?

**Explore more features:**

1. **Add AI/Vision** - Analyze photos with OpenAI, Claude, etc
2. **Database Integration** - Log all received photos to PostgreSQL
3. **Multiple Workflows** - Handle different message types (text, documents, etc)
4. **Scheduled Tasks** - Auto-cleanup old photos, send reports
5. **Production Deployment** - Docker Swarm, Kubernetes, Cloud platforms
6. **Custom Integrations** - Connect to external services (Slack, Email, etc)

Check [`INTEGRATION_GUIDE.md`](./INTEGRATION_GUIDE.md#-advanced-usage) for implementation examples.

---

## 📋 Project Files Summary

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Container orchestration - N8N, WhatsApp API, PostgreSQL |
| `whatsapp-api/Dockerfile` | Custom image for WhatsApp API server |
| `whatsapp-api/server.js` | Main WhatsApp API server code |
| `workflows/whatsapp-view-once-workflow.json` | N8N workflow template |
| `INTEGRATION_GUIDE.md` | **[📖 READ THIS]** Complete step-by-step setup |
| `WHATSAPP_SETUP.md` | Manual setup reference |
| `setup-whatsapp.sh` | Auto-setup script (Linux/Mac) |
| `setup-whatsapp.bat` | Auto-setup script (Windows) |

---

## ⚠️ Important

✅ **Before starting:**
- Docker & Docker Compose installed
- WhatsApp app on smartphone
- Ports 3000, 5678, 5432 available

⚠️ **Privacy & Security:**
- Don't share WhatsApp session
- Keep API key secure
- Data stored locally on your machine
- Comply with WhatsApp ToS

---

## 🎯 Ready?

👉 **Start here:** [`INTEGRATION_GUIDE.md`](./INTEGRATION_GUIDE.md)

**TL;DR:**
1. Link WhatsApp: `curl http://localhost:3000/qr` → Scan
2. Open N8N: http://localhost:5678 → Import workflow
3. Test: Send View Once photo → Check http://localhost:5678/executions

Let's go! 🚀
