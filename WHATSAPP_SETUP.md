# Setup N8N + Evolution API untuk WhatsApp Integration

## Langkah 1: Jalankan Kontainer

```bash
cd n8n-project
docker compose down
docker compose up -d
```

Tunggu 30-60 detik sampai semua service siap.

Verifikasi:
```bash
docker compose ps
```

## Langkah 2: Cek Status Services

### N8N
- URL: http://localhost:5678
- Status healthy check: `docker logs n8n-app | grep "ready"`

### Evolution API
- URL: http://localhost:8080
- API Key: check di .env atau docker-compose.yml (ganti `AUTH_API_KEY`)
- Status: `docker logs evolution-api | grep "ready"`

## Langkah 3: Setup Evolution API Instance

### 3a. Buat Instance Baru (Gunakan Postman atau Terminal)

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Authorization: Bearer your_secure_api_key_change_me_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "whatsapp-instance",
    "qrcode": true,
    "webhook": {
      "enabled": true,
      "url": "http://n8n-app:5678/webhook/whatsapp-webhook"
    }
  }'
```

Response akan berisi JSON dengan instance details.

### 3b. Generate QR Code

```bash
curl -X GET http://localhost:8080/instance/connect/whatsapp-instance \
  -H "Authorization: Bearer your_secure_api_key_change_me_12345"
```

Ini akan mengembalikan QR Code (base64 atau URL).

### 3c. Scan QR Code di WhatsApp

- Buka WhatsApp di HP Anda
- Buka: Settings → Linked Devices → Link a Device
- Scan QR Code yang tadi didapat
- Tunggu sampai "Device linked" confirmation

## Langkah 4: Verify Connection

```bash
curl -X GET http://localhost:8080/instance/info/whatsapp-instance \
  -H "Authorization: Bearer your_secure_api_key_change_me_12345"
```

Status harus `online` atau `connected`.

## Langkah 5: Setup N8N Workflow untuk Tangkap Foto View Once

Buka: http://localhost:5678

### 5a. Import Workflow Template
- Klik "Import" → Pilih file `whatsapp-view-once-workflow.json`

### 5b. Manual Setup (Jika tidak pakai template):

**Node 1: Webhook**
- Type: Webhook
- Method: POST
- Path: `/webhook/whatsapp-webhook`
- Response: 200 OK
- Save Response: ✓

**Node 2: Filter Pesan (If condition)**
- Condition: `json.data.type == "messages"` AND `json.data.message.mediaType == "imageMessage"`
- Continue jika TRUE

**Node 3: Extract Foto**
- Node Type: HTTP Request
- Method: GET
- URL: `http://evolution-api:8080/message/base64/{{ $json.instanceName }}`
- Auth: Bearer Token → `your_secure_api_key_change_me_12345`
- Body: `{ "messageId": "{{ $json.data.message.messageTimestamp }}" }`

**Node 4: Simpan File**
- Node Type: File
- Save to: `/home/node/.n8n/photos/{{ $json.data.message.messageTimestamp }}.jpg`
- File data: Base64 dari Node 3 output

**Node 5: Send Reply (Optional)**
- Node Type: HTTP Request
- Method: POST
- URL: `http://evolution-api:8080/message/send/{{ $json.instanceName }}`
- Body: 
```json
{
  "number": "{{ $json.data.message.from }}",
  "type": "text",
  "text": "Foto diterima! ✓"
}
```

## Langkah 6: Test

- Kirim foto View Once dari WhatsApp ke nomor yang sudah linked
- Buka N8N Workflow → lihat execution history
- Cek folder `/home/node/.n8n/photos/` apakah foto sudah tersimpan

## Troubleshooting

### Evolution API tidak bisa connect
```bash
docker logs evolution-api
```
Pastikan:
- PostgreSQL running dan healthy
- AUTH_API_KEY sudah benar
- WhatsApp sudah di-scan dengan benar

### Webhook tidak menerima pesan
- Verifikasi webhook URL di Evolution API instances
- Cek: `curl http://localhost:8080/instance/webhooks/whatsapp-instance`
- Pastikan N8N webhook path sesuai

### Foto tidak ter-extract
- Cek messageId format
- Pastikan instance name benar
- Cek Evolution API logs untuk error

## Security Notes

⚠️ **JANGAN** commit `.env` atau API keys ke git
⚠️ Ganti `AUTH_API_KEY` dengan password yang kuat
⚠️ Gunakan HTTPS untuk production (bukan http://localhost)
⚠️ Setup firewall agar port 8080 tidak publik

## Next Steps

1. Test kirim foto manual via WhatsApp
2. Tambahkan AI untuk analisis foto (OCR, vision, etc)
3. Setup database untuk tracking foto yang diterima
4. Add lebih banyak triggers (text, documents, etc)
5. Deploy ke production dengan proper security

