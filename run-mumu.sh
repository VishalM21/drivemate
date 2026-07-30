#!/bin/bash
# One-shot dev bootstrap for testing DriveMate.
#
# Starts (or reuses) everything needed to test the app on ANY device —
# MuMu Player, an AVD emulator, BlueStacks, or a real phone over the
# internet: Docker/Supabase local stack, a Cloudflare tunnel to the
# backend (auto-repairing, keeps .env + Metro in sync), and Metro itself
# running with Expo's built-in tunnel (`--tunnel`, via ngrok) so the app
# can load its JS bundle from anywhere too, not just this Mac.
#
# (A raw cloudflared tunnel in front of Metro does NOT work — Metro bakes
# its own listening port into the URLs it hands the app, which breaks once
# a tunnel remaps that port. Expo's --tunnel mode is aware of this and
# rewrites the URLs correctly, which is why it's used here instead.)
#
# Prints two links at the end — see README.md for what each one is for
# and where it goes.
#
# Usage: ./run-mumu.sh
# Re-run any time — every step is idempotent and skips what's already up.

set -uo pipefail

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$BASE_DIR/drivemate-backend"
FRONTEND_DIR="$BASE_DIR/drivemate-frontend"
ENV_FILE="$FRONTEND_DIR/.env"
LOG_DIR="$BASE_DIR/.devlogs"

mkdir -p "$LOG_DIR"

echo "=== 1/4 Docker Desktop ==="
if ! docker info >/dev/null 2>&1; then
  echo "Starting Docker Desktop (first boot can take a minute)..."
  open -a Docker
  until docker info >/dev/null 2>&1; do sleep 2; done
fi
echo "Docker is up."

echo ""
echo "=== 2/4 Supabase local stack ==="
cd "$BACKEND_DIR"
if supabase status >/dev/null 2>&1; then
  echo "Supabase already running."
else
  if ! supabase start 2>&1 | tee "$LOG_DIR/supabase-start.log"; then
    echo "First start failed, retrying with a clean stop..."
    supabase stop >/dev/null 2>&1
    supabase start 2>&1 | tee -a "$LOG_DIR/supabase-start.log"
  fi
fi

# Free RAM sanity check — this stack is heavy; on an 8GB Mac it competes
# with everything else you have open.
FREE_MB=$(($(vm_stat | awk '/Pages free/ {gsub(/\./,"",$3); print $3}') * $(pagesize) / 1024 / 1024))
if [ "$FREE_MB" -lt 300 ]; then
  echo "WARNING: only ~${FREE_MB}MB free RAM. If functions start timing out, close"
  echo "         a MuMu Player instance or other heavy apps (Chrome/Spotify/Teams)."
fi

echo ""
echo "=== 3/4 Backend tunnel watchdog (syncs .env + restarts Metro on rotation) ==="
if pgrep -f "scripts/tunnel-watch.sh" >/dev/null; then
  echo "Backend tunnel watchdog already running."
else
  nohup "$BASE_DIR/scripts/tunnel-watch.sh" > "$LOG_DIR/tunnel-watch.log" 2>&1 &
  disown
  echo "Backend tunnel watchdog started."
fi

echo "Waiting for a live backend tunnel URL..."
for _ in $(seq 1 40); do
  grep -q "trycloudflare.com" "$ENV_FILE" 2>/dev/null && break
  sleep 1
done

echo ""
echo "=== 4/4 Metro bundler (with --tunnel, so it works for any device) ==="
if lsof -i :8081 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Metro already running."
else
  (cd "$FRONTEND_DIR" && nohup npx expo start --dev-client --tunnel > "$LOG_DIR/metro.log" 2>&1 &)
  echo "Metro starting (ngrok tunnel can take ~20-30s on first boot)..."
  until lsof -i :8081 -sTCP:LISTEN >/dev/null 2>&1; do sleep 1; done
fi
echo "Metro is up on :8081."

# .env can briefly hold a stale URL left over from a previous run (the
# watchdog hasn't overwritten it yet), so don't trust presence alone —
# confirm each URL is actually live before printing it. For Metro's tunnel,
# query ngrok's local API directly (127.0.0.1:4040) rather than scraping
# logs — it reports the exact public URL Expo is using right now.
echo ""
echo "Verifying both tunnels are actually live..."

BACKEND_URL=""
for _ in $(seq 1 30); do
  CANDIDATE=$(grep '^EXPO_PUBLIC_SUPABASE_URL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2)
  if [ -n "$CANDIDATE" ]; then
    CODE=$(curl -s -m 8 -o /dev/null -w "%{http_code}" "$CANDIDATE/functions/v1/health" 2>/dev/null)
    if [ "$CODE" = "200" ]; then
      BACKEND_URL="$CANDIDATE"
      break
    fi
  fi
  sleep 2
done

APP_URL=""
for _ in $(seq 1 30); do
  CANDIDATE=$(curl -s -m 5 http://127.0.0.1:4040/api/tunnels 2>/dev/null \
    | jq -r '.tunnels[] | select(.proto=="https") | .public_url' 2>/dev/null | head -1)
  if [ -n "$CANDIDATE" ]; then
    CODE=$(curl -s -m 8 -o /dev/null -w "%{http_code}" "$CANDIDATE/status" 2>/dev/null)
    if [ "$CODE" = "200" ]; then
      APP_URL="$CANDIDATE"
      break
    fi
  fi
  sleep 2
done

echo ""
echo "=================================================================="
echo " APP URL — paste into the dev-client's 'Enter URL manually' field"
echo " (needed for a real phone, or any emulator on another machine):"
echo " ${APP_URL:-<not verified yet, check $LOG_DIR/metro.log for ngrok status>}"
echo ""
echo " BACKEND URL — for reference / manual API testing only."
echo " Already auto-synced into .env, nothing to paste for local testing:"
echo " ${BACKEND_URL:-<not verified yet, check $LOG_DIR/tunnel-watch.log>}"
echo "=================================================================="
echo ""
echo "Open the app, and on the dev-launcher screen tap 'Enter URL manually'"
echo "and paste the APP URL above. Works the same whether it's MuMu Player"
echo "on this Mac, another emulator, or a real phone anywhere with internet."
echo ""
echo "Everything is running in the background (Supabase, tunnel, Metro)."
echo "Tailing live logs below. Press Ctrl+C to stop watching (this does NOT"
echo "stop the servers; they keep running — just re-run this script later"
echo "and it'll reattach instead of restarting anything)."
echo "------------------------------------------------------------------"
sleep 1
exec tail -n 20 -f "$LOG_DIR/metro.log" "$LOG_DIR/tunnel-watch.log"
