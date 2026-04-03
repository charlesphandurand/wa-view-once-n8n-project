# 📱 N8N + Evolution API - Setup Lengkap Step-by-Step

## 🎯 Apa itu Evolution API?

Evolution API adalah REST API server yang menghubungkan N8N dengan WhatsApp.
- **Gratis** - Self-hosted di Docker Anda sendiri
- **Aman** - Semua data tersimpan di server lokal Anda
- **Mudah** - Menggunakan REST API yang sederhana

## 🔐 API Key - Anda Adalah Bosnya!

Karena ini self-hosted, Anda yang menentukan API Key-nya sendiri.

**API Key saat ini:**
```
your_super_secret_api_key_change_me_123456
```

⚠️ **PENTING**: Ganti dengan password yang kuat sebelum production!

---

## 📋 STEP-BY-STEP SETUP

### STEP 1: Start All Services

```bash
cd n8n-project
docker compose up -d
```

Tunggu 30-60 detik sampai semua container healthy.

Verifikasi:
```bash
docker compose ps
```

Expected output:
```
NAME           STATUS                 PORTS
n8n-app        Up (health: healthy)   0.0.0.0:5678->5678/tcp
postgres       Up (healthy)           0.0.0.0:5432->5432/tcp
evolution-api  Up (health: starting)  0.0.0.0:8080->8080/tcp
```

---

### STEP 2: Verify Evolution API Ready

Check health:
```bash
curl http://localhost:8080/health
```

Response yang diharapkan:
```json
{"status":"ok"}
```

---

### STEP 3: Create WhatsApp Instance

Buat "pintu" baru untuk WhatsApp dengan instance name yang Anda ingin.

**Pilihan 1: Via Terminal/Command**

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: your_super_secret_api_key_change_me_123456" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "wa_pribadi",
    "qrcode": true,
    "webhook": {
      "enabled": true,
      "url": "http://n8n:5678/webhook/whatsapp-webhook"
    }
  }'
```

Response (jika berhasil):
```json
{
  "instanceName": "wa_pribadi",
  "status": "created",
  "instance": {...}
}
```

**Pilihan 2: Via Postman atau API Tool**
- Method: POST
- URL: `http://localhost:8080/instance/create`
- Headers:
  - `apikey: your_super_secret_api_key_change_me_123456`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "instanceName": "wa_pribadi",
  "qrcode": true,
  "webhook": {
    "enabled": true,
    "url": "http://n8n:5678/webhook/whatsapp-webhook"
  }
}
```

---

### STEP 4: Get QR Code untuk Scan WhatsApp

```bash
curl -X GET http://localhost:8080/instance/connect/wa_pribadi \
  -H "apikey: your_super_secret_api_key_change_me_123456"
```

Response:
```json
{
  "qrCode": "[LARGE QR STRING]",
  "expireTime": 60000
}
```

**Decode QR Code:**

Ada 3 cara:

**Cara A: Online (Paling Mudah)**
1. Copy string QR dari response
2. Buka: https://webqr.com
3. Paste QR string
4. Scan dengan WhatsApp

**Cara B: Terminal (Jika ada qrencode)**
```bash
curl -X GET http://localhost:8080/instance/connect/wa_pribadi \
  -H "apikey: your_super_secret_api_key_change_me_123456" | \
  jq -r '.qrCode' | qrencode -t ANSI
```

**Cara C: Save as File**
```bash
curl -X GET http://localhost:8080/instance/connect/wa_pribadi \
  -H "apikey: your_super_secret_api_key_change_me_123456" | \
  jq -r '.qrCode' > qrcode.txt
# Kemudian paste qrcode.txt ke https://webqr.com
```

---

### STEP 5: Scan QR Code dengan WhatsApp

1. **Buka WhatsApp di HP Anda** (Android atau iPhone)
2. **Settings → Linked Devices** (atau Connected Devices)
3. **Tap: Link a Device / Scan Code**
4. **Scan QR Code** dari STEP 4
5. **Tunggu** sampai "Device linked successfully"

⏱️ QR code valid hanya **60 detik**. Jika expired, generate ulang dengan STEP 4.

---

### STEP 6: Verify WhatsApp Connected

```bash
curl -X GET http://localhost:8080/instance/info/wa_pribadi \
  -H "apikey: your_super_secret_api_key_change_me_123456"
```

Response (jika berhasil):
```json
{
  "instanceName": "wa_pribadi",
  "state": "open",
  "qrCode": null,
  "connected": true,
  "phoneNumber": "62812xxxxxxxx"
}
```

✅ **Status: open** = Connected dan siap digunakan!

---

## 🔧 Evolution API Endpoints Reference

### Authentication
```
Header: apikey: your_super_secret_api_key_change_me_123456
```

### Instance Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/instance/create` | POST | Buat instance baru |
| `/instance/info/{name}` | GET | Info instance |
| `/instance/connect/{name}` | GET | Dapatkan QR code |
| `/instance/logout/{name}` | DELETE | Logout WhatsApp |
| `/instance/restart/{name}` | POST | Restart instance |

### Messaging

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/message/send/{name}` | POST | Kirim pesan text |
| `/message/send-media/{name}` | POST | Kirim media (foto/video) |
| `/message/send-button/{name}` | POST | Kirim button message |

### Webhooks

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/webhook/set/{name}` | POST | Setup webhook |
| `/webhook/info/{name}` | GET | Info webhook |
| `/webhook/remove/{name}` | DELETE | Remove webhook |

---

## 📊 API Examples

### Contoh 1: Send Text Message

```bash
curl -X POST http://localhost:8080/message/send/wa_pribadi \
  -H "apikey: your_super_secret_api_key_change_me_123456" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "62812xxxxxxxx",
    "text": "Halo dari Evolution API!"
  }'
```

### Contoh 2: Send Media/Photo

```bash
curl -X POST http://localhost:8080/message/send-media/wa_pribadi \
  -H "apikey: your_super_secret_api_key_change_me_123456" \
  -F "number=62812xxxxxxxx" \
  -F "media=@/path/to/photo.jpg" \
  -F "caption=Foto dari N8N"
```

### Contoh 3: Webhook Configuration

Setup webhook agar Evolution API kirim semua pesan masuk ke N8N:

```bash
curl -X POST http://localhost:8080/webhook/set/wa_pribadi \
  -H "apikey: your_super_secret_api_key_change_me_123456" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://n8n:5678/webhook/whatsapp-webhook",
    "events": ["messages.upsert", "connection.update"]
  }'
```

---

## 🎯 Integration dengan N8N

### Setup N8N Webhook

1. **Buka N8N**: http://localhost:5678
2. **Buat workflow baru**
3. **Tambah node: Webhook**
   - Method: POST
   - Path: `/webhook/whatsapp-webhook`
   - Save Response: ON

4. **Tambah node: HTTP Request**
   - Method: POST
   - URL: `http://localhost:8080/message/send/wa_pribadi`
   - Headers:
     ```
     apikey: your_super_secret_api_key_change_me_123456
     ```
   - Body:
     ```json
     {
       "number": "{{ $json.senderNumber }}",
       "text": "Pesan diterima!"
     }
     ```

5. **Save & Activate**

### Test Flow

Kirim pesan ke nomor yang sudah linked:
- N8N akan menerima via webhook
- Auto-reply dengan "Pesan diterima!"

---

## 🐛 Troubleshooting

### Error: QR Code Expired
**Solusi**: Generate ulang dengan STEP 4. QR hanya valid 60 detik.

### Error: Invalid API Key
**Solusi**: Pastikan header apikey benar:
```
apikey: your_super_secret_api_key_change_me_123456
```

### Error: Connection Timeout
**Solusi**: 
```bash
# Check if Evolution API container running
docker ps | grep evolution

# Check logs
docker logs evolution-api

# Restart
docker restart evolution-api
```

### Error: WhatsApp Logout
**Solusi**: 
```bash
# Logout instance
curl -X DELETE http://localhost:8080/instance/logout/wa_pribadi \
  -H "apikey: your_super_secret_api_key_change_me_123456"

# Generate QR lagi
curl -X GET http://localhost:8080/instance/connect/wa_pribadi \
  -H "apikey: your_super_secret_api_key_change_me_123456"
```

---

## 📝 Important Notes

⚠️ **Security:**
- Jangan commit API key ke git
- Ganti `your_super_secret_api_key_change_me_123456` dengan password kuat
- Untuk production, gunakan environment variables

⚠️ **WhatsApp ToS:**
- Penggunaan Linked Device harus comply dengan WhatsApp ToS
- Jangan gunakan untuk spam atau penyalahgunaan
- Rate limit: ikuti WhatsApp API limits

⚠️ **Data Privacy:**
- Semua data tersimpan lokal di Docker Anda
- Backup database PostgreSQL secara berkala
- Setup proper access control

---

## 📚 File Structure

```
n8n-project/
├── docker-compose.yml          # Konfigurasi N8N + Evolution
├── SETUP_GUIDE.md              # Guide ini
└── workflows/
    └── whatsapp-example.json   # Contoh workflow
```

---

## 🚀 Next Steps

1. ✅ Start services (STEP 1)
2. ✅ Verify Evolution API (STEP 2)
3. ✅ Create instance (STEP 3)
4. ✅ Get QR code (STEP 4)
5. ✅ Scan dengan WhatsApp (STEP 5)
6. ✅ Verify connected (STEP 6)
7. ✅ Setup N8N webhook
8. ✅ Test send message
9. ✅ Create custom workflows

---

## 💬 Quick Command Reference

```bash
# Start services
docker compose up -d

# Check status
docker compose ps

# View logs
docker logs evolution-api
docker logs n8n-app

# Get QR code
curl -X GET http://localhost:8080/instance/connect/wa_pribadi \
  -H "apikey: your_super_secret_api_key_change_me_123456"

# Check connection
curl -X GET http://localhost:8080/instance/info/wa_pribadi \
  -H "apikey: your_super_secret_api_key_change_me_123456"

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v
```

---

**Siap untuk mulai? Mari kita eksekusi STEP 1! 🚀**
