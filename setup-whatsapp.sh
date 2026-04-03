#!/bin/bash

# Setup script untuk N8N + Evolution API + WhatsApp Integration
# Run this setelah docker compose up -d

set -e

API_KEY="your_secure_api_key_change_me_12345"
EVOLUTION_URL="http://localhost:8080"
INSTANCE_NAME="whatsapp-instance"
WEBHOOK_URL="http://localhost:5678/webhook/whatsapp-webhook"

echo "🚀 Starting N8N WhatsApp Integration Setup..."
echo ""

# Check if Evolution API is ready
echo "1️⃣  Waiting for Evolution API to be ready..."
sleep 5
for i in {1..30}; do
  if curl -s "$EVOLUTION_URL/health" > /dev/null 2>&1; then
    echo "✅ Evolution API is ready!"
    break
  fi
  echo "   Waiting... ($i/30)"
  sleep 2
done

echo ""
echo "2️⃣  Creating WhatsApp instance..."
echo "   URL: $EVOLUTION_URL/instance/create"
echo "   Instance: $INSTANCE_NAME"

RESPONSE=$(curl -s -X POST "$EVOLUTION_URL/instance/create" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"instanceName\": \"$INSTANCE_NAME\",
    \"qrcode\": true,
    \"webhook\": {
      \"enabled\": true,
      \"url\": \"$WEBHOOK_URL\"
    }
  }")

echo "   Response: $RESPONSE"
echo ""

echo "3️⃣  Getting QR Code for WhatsApp Login..."
echo "   Generating QR Code..."

QR_RESPONSE=$(curl -s -X GET "$EVOLUTION_URL/instance/connect/$INSTANCE_NAME" \
  -H "Authorization: Bearer $API_KEY")

echo "   QR Code Response:"
echo "$QR_RESPONSE" | head -c 100
echo "..."
echo ""

echo "4️⃣  Instance Info:"
INFO=$(curl -s -X GET "$EVOLUTION_URL/instance/info/$INSTANCE_NAME" \
  -H "Authorization: Bearer $API_KEY")

echo "$INFO" | grep -o '"status":"[^"]*"' || echo "Instance created, pending QR scan"
echo ""

echo "📱 NEXT STEPS:"
echo "1. Open WhatsApp on your phone"
echo "2. Go to: Settings → Linked Devices → Link a Device"
echo "3. Scan the QR Code from step 3 above"
echo "4. Wait for 'Device linked' confirmation"
echo ""
echo "5. To see QR Code again:"
echo "   curl -X GET http://localhost:8080/instance/connect/$INSTANCE_NAME \\"
echo "     -H 'Authorization: Bearer $API_KEY'"
echo ""
echo "6. To check status:"
echo "   curl -X GET http://localhost:8080/instance/info/$INSTANCE_NAME \\"
echo "     -H 'Authorization: Bearer $API_KEY'"
echo ""

echo "🎯 Once WhatsApp is linked:"
echo "   - Go to http://localhost:5678"
echo "   - Import workflows/whatsapp-view-once-workflow.json"
echo "   - Send a View Once photo to test!"
echo ""
