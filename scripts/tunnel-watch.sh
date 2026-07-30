#!/bin/bash
# Keeps a Cloudflare quick tunnel to the local Supabase gateway (port 54321)
# alive. Health-checks and reconnects as a safety net, and whenever the
# assigned subdomain changes, rewrites drivemate-frontend/.env and restarts
# Metro so the app always points at a live tunnel instead of a dead one.
#
# Run via run-mumu.sh — not meant to be launched directly.

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)/drivemate-frontend"
ENV_FILE="$FRONTEND_DIR/.env"
LOG_DIR="$(cd "$(dirname "$0")/.." && pwd)/.devlogs"
CF_LOG="$LOG_DIR/cf-tunnel-current.log"
METRO_LOG="$LOG_DIR/metro.log"
PORT=54321
LAST_URL=""

mkdir -p "$LOG_DIR"

sync_env_and_restart_metro() {
  local url="$1"
  sed -i '' "s#^EXPO_PUBLIC_API_BASE_URL=.*#EXPO_PUBLIC_API_BASE_URL=${url}/functions/v1#" "$ENV_FILE"
  sed -i '' "s#^EXPO_PUBLIC_SUPABASE_URL=.*#EXPO_PUBLIC_SUPABASE_URL=${url}#" "$ENV_FILE"
  echo "$(date '+%H:%M:%S') tunnel URL changed -> ${url} (env updated)"

  pkill -f "expo start --dev-client" 2>/dev/null
  sleep 1
  (cd "$FRONTEND_DIR" && nohup npx expo start --dev-client --tunnel > "$METRO_LOG" 2>&1 &)
  echo "$(date '+%H:%M:%S') Metro restarted (with --tunnel)"
}

while true; do
  : > "$CF_LOG"
  cloudflared tunnel --url "http://localhost:$PORT" >> "$CF_LOG" 2>&1 &
  CF_PID=$!

  URL=""
  for _ in $(seq 1 20); do
    URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$CF_LOG" | head -1)
    [ -n "$URL" ] && break
    sleep 1
  done

  if [ -z "$URL" ]; then
    echo "$(date '+%H:%M:%S') no URL granted, retrying..."
    kill "$CF_PID" 2>/dev/null
    sleep 2
    continue
  fi

  if [ "$URL" != "$LAST_URL" ]; then
    LAST_URL="$URL"
    sync_env_and_restart_metro "$URL"
  fi

  FAIL_COUNT=0
  while kill -0 "$CF_PID" 2>/dev/null; do
    sleep 15
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$URL")
    if [ "$CODE" = "404" ] || [ "$CODE" = "200" ]; then
      FAIL_COUNT=0
    else
      FAIL_COUNT=$((FAIL_COUNT + 1))
      echo "$(date '+%H:%M:%S') health check failed (code=$CODE), fail_count=$FAIL_COUNT"
      if [ "$FAIL_COUNT" -ge 3 ]; then
        echo "$(date '+%H:%M:%S') tunnel unhealthy, forcing reconnect"
        kill "$CF_PID" 2>/dev/null
        break
      fi
    fi
  done

  wait "$CF_PID" 2>/dev/null
  echo "$(date '+%H:%M:%S') tunnel process exited, reconnecting..."
  sleep 2
done
