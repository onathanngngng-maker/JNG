#!/bin/bash
cd "$(dirname "$0")"

echo "Stopping Paper Gen..."

if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  lsof -nP -iTCP:3000 -sTCP:LISTEN -t | xargs kill 2>/dev/null || true
  sleep 0.4
  lsof -nP -iTCP:3000 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
  echo "Stopped the local website (port 3000)."
else
  echo "Local website was not running."
fi

if pgrep -f "cloudflared tunnel --url" >/dev/null 2>&1; then
  pkill -f "cloudflared tunnel --url" 2>/dev/null || true
  echo "Stopped the professor public link."
else
  echo "Public link was not running."
fi

echo "Done. Start again with ./start.sh (only you) or ./start-share.sh (you + professor)."
