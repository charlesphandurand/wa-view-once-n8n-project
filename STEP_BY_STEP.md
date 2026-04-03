# 📱 N8N + WhatsApp API - STEP BY STEP SETUP

## 🎯 Overview

```
Smartphone (WhatsApp)
        ↓ (Linked Device)
WhatsApp API Server (Port 3000)
        ↓ (REST API)
N8N Automation (Port 5678)
        ↓
Your Workflows
```

**API Key (Self-Hosted):**
```
your_super_secret_api_key_change_me_123456
```

---

## ✅ STATUS: All Services Running!

```
✅ N8N               - http://localhost:5678
✅ WhatsApp API      - http://localhost:3000
✅ PostgreSQL        - localhost:5432 (internal)
```

---

## 📋 LANGKAH DEMI LANGKAH

### STEP 1: Verify Services Running

```bash
cd n8n-project
docker compose ps
```

Expected:
```
NAME           STATUS                 PORTS
n8n-app        Up (health: healthy)   5678
n8n-postgres   Up (healthy)           5432
whatsapp-api   Up (health: starting)  3000
```

✅ **Check:**
```bash
curl http://localhost:3000/api/health
```

Response: `{"ok":true,"connected":false}`

---

### STEP 2: Get QR Code

WhatsApp API server akan generate QR code untuk Anda scan.

**Command:**
```bash
curl -X GET http://localhost:3000/api/qr \
  -H "apikey: your_super_secret_api_key_change_me_123456"
```

**Response:**
```json
{
  "qrCode": "1@XxXxXxXxXx..."
}
```

**Decode QR Code (3 Options):**

**Option A: Online (MUDAH)**
1. Copy QR string dari response
2. Buka: https://webqr.com
3. Paste QR string di textarea
4. Lihat gambar QR code
5. Scan dengan HP

**Option B: Terminal (Jika ada qrencode)**
```bash
# Install qrencode dulu (optional)
curl -X GET http://localhost:3000/api/qr \
  -H "apikey: your_super_secret_api_key_change_me_123456" | \
  jq -r '.qrCode' | qrencode -t ANSI
```

**Option C: Save ke file**
```bash
curl -X GET http://localhost:3000/api/qr \
  -H "apikey: your_super_secret_api_key_change_me_123456" | \
  jq -r '.qrCode' > qrcode.txt

# Kemudian copy isi qrcode.txt dan paste ke https://webqr.com
```

---

### STEP 3: Scan QR Code dengan WhatsApp

1. **Buka WhatsApp di HP** (Android/iPhone)
2. **Settings / Pengaturan**
3. **Linked Devices** / **Perangkat Tertaut**
4. **Link a Device** / **Hubungkan Perangkat**
5. **Scan QR Code** dari STEP 2
6. **Tunggu 5-10 detik**
7. Seharusnya muncul: **"Device linked successfully"**

⏱️ **QR valid 60 detik. Jika expired, generate ulang.**

---

### STEP 4: Verify WhatsApp Connected

```bash
curl -X GET http://localhost:3000/api/status \
  -H "apikey: your_super_secret_api_key_change_me_123456"
```

**Response (Jika berhasil):**
```json
{
  "connected": true,
  "hasQR": false,
  "message": "Connected"
}
```

✅ **Status `connected: true` = Berhasil!**

---

### STEP 5: Test Send Message

Kirim test message dari WhatsApp API ke WhatsApp Anda:

```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "apikey: your_super_secret_api_key_change_me_123456" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "6281234567890",
    "text": "Test message dari API!"
  }'
```

**Note:** Ganti `6281234567890` dengan nomor WhatsApp Anda (format: 62...)

**Response (Jika berhasil):**
```json
{
  "success": true,
  "message": "Message sent"
}
```

Cek WhatsApp Anda - seharusnya ada pesan masuk!

---

### STEP 6: Setup N8N Webhook

Sekarang konfigurasi N8N agar menerima pesan dari WhatsApp API.

1. **Buka N8N**: http://localhost:5678
2. **Buat workflow baru** (click "+" atau "New Workflow")
3. **Tambah node: Webhook**
   - Click: **Add Node**
   - Search: **Webhook**
   - Select: **Webhook**

4. **Configure Webhook Node:**
   - **HTTP Method:** POST
   - **Path:** `/webhook/whatsapp` (atau nama apa saja)
   - **Response Mode:** Last Node
   - **Save Response:** Toggle ON
   - Copy URL yang ditampilkan (mis: `http://localhost:5678/webhook/webhook_xxxxx`)

5. **Tambah node: Response**
   - Click: **Add Node**
   - Search: **Response**
   - Select: **Respond to Webhook**

6. **Save Workflow**
   - Click: **Save**
   - Give it a name: **WhatsApp Test**

7. **Activate Workflow**
   - Click: **Activate** (toggle di atas)

---

### STEP 7: Configure WhatsApp API Webhook

Beritahu WhatsApp API untuk mengirim semua pesan ke N8N webhook:

```bash
# Ganti URL dengan webhook URL dari STEP 6
curl -X POST http://localhost:3000/api/send-message \
  -H "apikey: your_super_secret_api_key_change_me_123456" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "6281234567890",
    "text": "Webhook test"
  }'
```

**Actually**, WhatsApp API sudah auto-send ke webhook URL di environment variable:
```
N8N_WEBHOOK_URL: http://n8n:5678/webhook/whatsapp-webhook
```

Jadi Anda perlu create webhook dengan path: `/whatsapp-webhook` di N8N.

---

### STEP 8: Test End-to-End

Sekarang test pengiriman pesan dari WhatsApp Anda:

1. **Kirim pesan ke nomor WhatsApp API** (nomor yang sudah linked)
2. **Pesan akan diterima:**
   - WhatsApp API menangkap
   - Kirim webhook ke N8N
   - N8N workflow trigger
3. **Lihat execution di N8N:**
   - Buka workflow
   - Click: **Executions**
   - Lihat execution terbaru
   - Klik untuk lihat detail data

---

## 🔑 API Key Management

### Mengapa API Key?

API key adalah "password" untuk akses WhatsApp API Anda.

**Current Key:**
```
your_super_secret_api_key_change_me_123456
```

### Cara Menggunakan API Key

Semua API endpoint memerlukan header:
```
apikey: your_super_secret_api_key_change_me_123456
```

**Contoh:**
```bash
curl http://localhost:3000/api/status \
  -H "apikey: your_super_secret_api_key_change_me_123456"
```

### Cara Mengubah API Key

1. **Buka file:** `docker-compose.yml`
2. **Cari baris:**
   ```yaml
   API_KEY: your_super_secret_api_key_change_me_123456
   ```
3. **Ganti dengan password baru (Contoh):**
   ```yaml
   API_KEY: super_rahasia_password_baru_12345
   ```
4. **Restart services:**
   ```bash
   docker compose down
   docker compose up -d
   ```

⚠️ **Gunakan password yang kuat! Contoh format:**
```
super_rahasia_n8n_wa_12345_abcdef_xyz
```

---

## 📚 API Reference

### Semua Endpoint Memerlukan Header:
```
apikey: your_super_secret_api_key_change_me_123456
```

### Endpoints:

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/health` | GET | Health check | ❌ |
| `/api/status` | GET | Connection status | ✅ |
| `/api/qr` | GET | Get QR code | ✅ |
| `/api/info` | GET | Instance info | ✅ |
| `/api/send-message` | POST | Send message | ✅ |

### Example: Send Message

```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "apikey: your_super_secret_api_key_change_me_123456" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "6281234567890",
    "text": "Hello from API!"
  }'
```

**Body Parameters:**
- `number` (required): Nomor WhatsApp (format: 62...)
- `text` (required): Pesan text

**Response:**
```json
{
  "success": true,
  "message": "Message sent"
}
```

---

## 🎯 Full N8N Workflow Example

**Scenario:** Terima pesan WhatsApp → Log ke database → Reply dengan pesan

1. **Node 1: Webhook**
   - Path: `/whatsapp-webhook`
   - Method: POST

2. **Node 2: Split in Batches**
   - Size: 1

3. **Node 3: PostgreSQL**
   - Hostname: postgres
   - Database: n8n
   - Query:
     ```sql
     INSERT INTO messages (number, text, timestamp)
     VALUES ($1, $2, NOW());
     ```
   - Parameters: `$json.from`, `$json.message.text`

4. **Node 4: HTTP Request**
   - Method: POST
   - URL: `http://localhost:3000/api/send-message`
   - Headers: `apikey: your_super_secret_api_key_change_me_123456`
   - Body:
     ```json
     {
       "number": "{{ $json.from }}",
       "text": "Terima kasih! Pesan Anda sudah kami terima."
     }
     ```

5. **Node 5: Respond to Webhook**
   - Status Code: 200

**Save & Activate!**

---

## 🐛 Troubleshooting

### Error: Invalid API Key
```
{"error":"Invalid API key"}
```

**Solusi:** Pastikan header apikey benar:
```bash
curl ... -H "apikey: your_super_secret_api_key_change_me_123456"
```

### Error: No QR Code Available
```
{"error":"No QR code available"}
```

**Solusi:** 
- WhatsApp API masih initialize (tunggu 10 detik)
- Atau sudah connected (check `/api/status`)

### Error: Not Connected
```
{"error":"Not connected. Scan QR code first."}
```

**Solusi:**
1. Generate QR: `/api/qr`
2. Scan dengan WhatsApp
3. Tunggu 5-10 detik
4. Cek `/api/status` harus `connected: true`

### WhatsApp Logged Out
```bash
# Restart services
docker restart whatsapp-api

# Generate QR lagi
curl http://localhost:3000/api/qr \
  -H "apikey: your_super_secret_api_key_change_me_123456"
```

### Container Not Running
```bash
# Check status
docker compose ps

# Check logs
docker logs whatsapp-api
docker logs n8n-app

# Restart
docker compose restart whatsapp-api
```

---

## 📝 Important Security Notes

⚠️ **API Key:**
- Jangan hardcode di kode yang di-push ke git
- Gunakan environment variables untuk production
- Ganti default key dengan password kuat

⚠️ **WhatsApp Terms:**
- Gunakan hanya untuk automation yang sah
- Jangan gunakan untuk spam
- Comply dengan WhatsApp ToS

⚠️ **Data Privacy:**
- Semua data stored lokal di Docker
- Backup database PostgreSQL secara berkala
- Setup proper access control

---

## 🚀 Quick Command Reference

```bash
# Start all services
cd n8n-project
docker compose up -d

# Check status
docker compose ps

# Get QR code
curl -X GET http://localhost:3000/api/qr \
  -H "apikey: your_super_secret_api_key_change_me_123456"

# Check WhatsApp status
curl http://localhost:3000/api/status \
  -H "apikey: your_super_secret_api_key_change_me_123456"

# Send test message
curl -X POST http://localhost:3000/api/send-message \
  -H "apikey: your_super_secret_api_key_change_me_123456" \
  -H "Content-Type: application/json" \
  -d '{"number":"62812xxxxx","text":"Test"}'

# View logs
docker logs whatsapp-api
docker logs n8n-app

# Stop all
docker compose down

# Full clean (delete volumes)
docker compose down -v
```

---

## ✅ Checklist

- [ ] STEP 1: Services running?
- [ ] STEP 2: Get QR code?
- [ ] STEP 3: Scan dengan WhatsApp?
- [ ] STEP 4: Status connected?
- [ ] STEP 5: Test send message?
- [ ] STEP 6: N8N webhook ready?
- [ ] STEP 7: Webhook configured?
- [ ] STEP 8: End-to-end test works?

**If all checked ✅ - Selamat! Setup selesai! 🎉**

---

**Next:** Buat custom workflows sesuai kebutuhan Anda!
