@echo off
REM Setup script untuk N8N + Evolution API + WhatsApp Integration (Windows)
REM Run this after docker compose up -d

setlocal enabledelayedexpansion

set API_KEY=your_secure_api_key_change_me_12345
set EVOLUTION_URL=http://localhost:8080
set INSTANCE_NAME=whatsapp-instance
set WEBHOOK_URL=http://localhost:5678/webhook/whatsapp-webhook

echo.
echo 🚀 Starting N8N WhatsApp Integration Setup...
echo.

echo 1️⃣  Waiting for Evolution API to be ready...
timeout /t 5 /nobreak

for /L %%i in (1,1,30) do (
  curl -s "%EVOLUTION_URL%/health" >nul 2>&1
  if !errorlevel! equ 0 (
    echo ✅ Evolution API is ready!
    goto :next_step
  )
  echo    Waiting... (%%i/30)
  timeout /t 2 /nobreak
)

:next_step
echo.
echo 2️⃣  Creating WhatsApp instance...
echo    URL: %EVOLUTION_URL%/instance/create
echo    Instance: %INSTANCE_NAME%

curl -X POST "%EVOLUTION_URL%/instance/create" ^
  -H "Authorization: Bearer %API_KEY%" ^
  -H "Content-Type: application/json" ^
  -d "{\"instanceName\": \"%INSTANCE_NAME%\", \"qrcode\": true, \"webhook\": {\"enabled\": true, \"url\": \"%WEBHOOK_URL%\"}}"

echo.
echo.
echo 3️⃣  Getting QR Code for WhatsApp Login...
echo    Generating QR Code...

curl -X GET "%EVOLUTION_URL%/instance/connect/%INSTANCE_NAME%" ^
  -H "Authorization: Bearer %API_KEY%"

echo.
echo.
echo 4️⃣  Instance Info:

curl -X GET "%EVOLUTION_URL%/instance/info/%INSTANCE_NAME%" ^
  -H "Authorization: Bearer %API_KEY%"

echo.
echo.
echo 📱 NEXT STEPS:
echo 1. Open WhatsApp on your phone
echo 2. Go to: Settings ^→ Linked Devices ^→ Link a Device
echo 3. Scan the QR Code from step 3 above
echo 4. Wait for 'Device linked' confirmation
echo.
echo 5. To see QR Code again:
echo    curl -X GET http://localhost:8080/instance/connect/%INSTANCE_NAME% ^
echo      -H "Authorization: Bearer %API_KEY%"
echo.
echo 6. To check status:
echo    curl -X GET http://localhost:8080/instance/info/%INSTANCE_NAME% ^
echo      -H "Authorization: Bearer %API_KEY%"
echo.
echo 🎯 Once WhatsApp is linked:
echo    - Go to http://localhost:5678
echo    - Import workflows/whatsapp-view-once-workflow.json
echo    - Send a View Once photo to test!
echo.

endlocal
