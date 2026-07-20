#!/bin/bash

echo "🚀 Resuming Drivemate Development Environment..."

# Find absolute paths
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$BASE_DIR/drivemate-backend"
FRONTEND_DIR="$BASE_DIR/drivemate-frontend"

# 1. Start Supabase (requires Docker Desktop to be running)
echo "--------------------------------------------------"
echo "1. Starting Supabase Docker containers..."
echo "--------------------------------------------------"
cd "$BACKEND_DIR"
supabase start

# 2. Open a new terminal window for Edge Functions
echo "2. Launching Edge Functions server tab..."
osascript -e "tell application \"Terminal\" to do script \"cd '$BACKEND_DIR' && supabase functions serve --env-file supabase/functions/.env\""

# 3. Open a new terminal window for Localtunnel auto-restart loop
echo "3. Launching Localtunnel auto-restart tab..."
osascript -e "tell application \"Terminal\" to do script \"while true; do npx localtunnel --port 54321 --subdomain major-dragons-travel; sleep 2; done\""

# 4. Open a new terminal window for Metro Bundler
echo "4. Launching Metro Bundler tab..."
osascript -e "tell application \"Terminal\" to do script \"cd '$FRONTEND_DIR' && npx expo start\""

# 5. Build updated APK and copy to root
echo "--------------------------------------------------"
echo "5. Recompiling Android APK locally with Maps API Key..."
echo "--------------------------------------------------"
cd "$FRONTEND_DIR/android"
./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk "$FRONTEND_DIR/app-debug.apk"

echo "--------------------------------------------------"
echo "✅ Done! All servers are running in separate terminal tabs."
echo "👉 Action: Drag '$FRONTEND_DIR/app-debug.apk' into MuMu Player to install the fixed app."
echo "--------------------------------------------------"
