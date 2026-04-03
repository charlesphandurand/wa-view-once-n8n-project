# 🚀 N8N + WhatsApp Integration - Step by Step Guide

## Status: ✅ Semua Container Running

Anda sudah punya 3 services running:
- **N8N** (http://localhost:5678) - Automation platform
- **WhatsApp API** (http://localhost:3000) - WhatsApp bridge
- **PostgreSQL** (localhost:5432) - Database

---

## 📱 LANGKAH 1: Setup WhatsApp Connection

### 1.1 Cek Status WhatsApp API
```bash
curl http://localhost:3000/status
```

Response yang diharapkan:
```json
{
  "connected": false,
  "qrCode": null,
  "message": "WhatsApp disconnected"
}
```

### 1.2 Generate QR Code
```bash
curl http://localhost:3000/qr
```

Ini akan mengembalikan QR Code. Copy-paste QR string ke QR Decoder (https://webqr.com) atau gunakan command:
```bash
# Linux/Mac - Display QR dengan qrencode (jika terinstall)
curl http://localhost:3000/qr | grep -o '"qrCode":"[^"]*' | cut -d'"' -f4 | qrencode -t ANSI

# Atau buka langsung di browser dan lihat response
```

### 1.3 Scan QR dengan WhatsApp

1. **Buka WhatsApp di smartphone** (bukan web)
2. Tap **Settings** (⚙️)
3. Tap **Linked Devices**
4. Tap **Link a Device**
5. **Scan QR Code** dari step 1.2

**Tunggu sampai status berubah ke "Device linked"**

### 1.4 Verifikasi Koneksi
```bash
curl http://localhost:3000/status
```

Response seharusnya jadi:
```json
{
  "connected": true,
  "qrCode": null,
  "message": "WhatsApp connected"
}
```

---

## 🎯 LANGKAH 2: Setup N8N Workflow

### 2.1 Buka N8N Dashboard
Buka browser: **http://localhost:5678**

### 2.2 Import Workflow Template

**Option A: Menggunakan Upload File**
- Click "Import" di N8N
- Upload file `workflows/whatsapp-view-once-workflow.json`
- Click "Import"

**Option B: Manual Setup** (Jika tidak ada template file)
Ikuti langkah di `WHATSAPP_SETUP.md` Langkah 5 untuk membuat nodes secara manual.

### 2.3 Konfigurasi Webhook
- Buka workflow yang sudah diimport
- Klik node "Webhook"
- Salin path webhook: `/webhook/whatsapp-webhook`
- Ini adalah endpoint yang akan menerima pesan dari WhatsApp API

---

## 🧪 LANGKAH 3: Test Flow

### 3.1 Aktivasi Workflow
- Di N8N, klik **"Save"**
- Klik **"Activate"** (tombol di kanan atas)
- Status should show: **Workflow is active**

### 3.2 Test Kirim Foto View Once

1. **Dari HP Anda** - Buka WhatsApp
2. **Kirim Photo/Media** ke nomor yang sudah linked sebagai **"View Once"** (bukan foto normal)
   - iOS: Foto → Edit → Send as View Once  
   - Android: Foto → View Once (opsi saat send)

3. **Monitor di N8N**:
   - Buka workflow
   - Klik "Executions" di tab kanan
   - Tunggu ada execution baru
   - Klik execution → lihat input/output setiap node

### 3.3 Verifikasi Foto Tersimpan
```bash
# Cek folder photos
docker exec n8n-app ls -la /home/node/.n8n/photos/

# Atau lihat di volume
docker volume inspect n8n-project_whatsapp_photos
```

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────┐
│                Your Smartphone                      │
│              (WhatsApp installed)                   │
└────────────────────┬────────────────────────────────┘
                     │ QR Scan + Linked Device
                     ▼
┌─────────────────────────────────────────────────────┐
│         WhatsApp API Container (Port 3000)          │
│  Uses Baileys library untuk WhatsApp integration    │
│  ├─ /status → Check connection status               │
│  ├─ /qr → Get QR Code                               │
│  └─ Sends webhooks to N8N                           │
└────────────────────┬────────────────────────────────┘
                     │ HTTP POST
                     │ Webhook: /webhook/whatsapp-webhook
                     ▼
┌─────────────────────────────────────────────────────┐
│              N8N Container (Port 5678)              │
│  ├─ Webhook Node (menerima data WhatsApp)           │
│  ├─ Filter Node (check jika ada media)              │
│  ├─ Extract Node (decode media)                     │
│  ├─ File Node (simpan ke disk)                      │
│  └─ Reply Node (send confirmation balik)            │
└────────────────────┬────────────────────────────────┘
                     │ Simpan foto
                     ▼
┌─────────────────────────────────────────────────────┐
│     Filesystem / Photos Volume                      │
│  /home/node/.n8n/photos/[timestamp].jpg             │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### ❌ WhatsApp tidak bisa connect

**Check logs:**
```bash
docker logs whatsapp-api
```

**Common issues:**
- QR Code sudah expired → Generate baru dengan `curl http://localhost:3000/qr`
- HP belum linked → Scan ulang QR code
- Baileys library issue → Restart container:
  ```bash
  docker restart whatsapp-api
  ```

### ❌ Webhook tidak menerima pesan

**Check N8N logs:**
```bash
docker logs n8n-app
```

**Verifikasi webhook aktif:**
```bash
curl -X GET http://localhost:5678/webhook/whatsapp-webhook
```

**Jika masih error:**
- Pastikan workflow sudah "Activated"
- Cek path webhook di N8N match dengan code
- Restart N8N:
  ```bash
  docker restart n8n-app
  ```

### ❌ Foto tidak tersimpan

**Check execution detail:**
- Di N8N, klik execution → klik node "Save Photo File"
- Lihat error message di output
- Path harus writable: `/home/node/.n8n/photos/`

**Manual check:**
```bash
docker exec n8n-app mkdir -p /home/node/.n8n/photos/
docker exec n8n-app chmod 777 /home/node/.n8n/photos/
```

---

## 🛠️ Advanced Usage

### 1. Send Reply Message Otomatis
Node "Send Reply" sudah included - Workflow akan reply "Foto diterima! ✓" setiap kali foto terima.

Untuk customize:
- Edit node "Send Reply Message"
- Ubah text di field "text"

### 2. Simpan ke Database
Tambahkan node "PostgreSQL" setelah "Save Photo File":
- Query: `INSERT INTO photos (timestamp, filename) VALUES ($1, $2)`
- Params: timestamp, filename

### 3. Integrate dengan AI/OCR
Tambahkan node HTTP Request setelah extract foto:
- URL: `https://api.ocr.space/parse`
- Method: POST
- Upload gambar → Extract text

### 4. Store Multiple Files
Ubah path di node "Save Photo File":
```
/home/node/.n8n/photos/{{ $json.data.message.from }}/{{ $json.data.message.messageTimestamp }}.jpg
```

---

## 📚 Quick Commands Reference

```bash
# Status semua container
cd n8n-project && docker compose ps

# Lihat logs
docker logs whatsapp-api          # WhatsApp API logs
docker logs n8n-app               # N8N logs
docker logs n8n-postgres          # Database logs

# Restart services
docker compose restart whatsapp-api
docker compose restart n8n-app

# Stop semua
docker compose down

# Start lagi
docker compose up -d

# Clean volume (WARNING: hapus semua data)
docker compose down -v
```

---

## 🎓 Next Steps

✅ **Done:**
- WhatsApp linked ke API
- N8N workflow setup
- Foto View Once bisa ditangkap

🔄 **Next:**
- [ ] Test dengan berbagai jenis media (dokumen, video, dll)
- [ ] Add database logging untuk tracking
- [ ] Setup scheduling task (misal, cleanup foto setiap hari)
- [ ] Deploy ke production dengan HTTPS
- [ ] Add authentication ke API
- [ ] Integrate lebih banyak automation (AI analysis, forwarding, dll)

---

## ⚠️ Important Notes

⚠️ **Security:**
- Jangan share WhatsApp session ke orang lain
- API port 3000 sebaiknya tidak public
- Setup firewall dengan baik

⚠️ **WhatsApp Terms:**
- Penggunaan Baileys/linked device harus comply dengan ToS WhatsApp
- Jangan gunakan untuk spam atau penyalahgunaan

⚠️ **Data Privacy:**
- Foto yang ditangkap disimpan lokal
- Setup proper access control di production

---

## 📞 Support

Jika ada masalah:
1. Check docker logs
2. Verifikasi koneksi dengan curl commands
3. Cek file konfigurasi
4. Restart container yang bermasalah

Good luck! 🚀
