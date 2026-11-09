#!/bin/bash
set -e
cd "$(dirname "$0")"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT/.conda/bin:$PATH"

echo "Starting Paper Gen for you and for a public professor link..."
echo "Keep this computer awake. Press Control+C to stop both."

if ! lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  npm run dev &
  NEXT_PID=$!
  trap 'kill $NEXT_PID 2>/dev/null; pkill -f "cloudflared tunnel --url" 2>/dev/null; exit 0' INT TERM
  until lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; do
    sleep 0.4
  done
else
  trap 'pkill -f "cloudflared tunnel --url" 2>/dev/null; exit 0' INT TERM
fi

echo "Local site: http://localhost:3000"
echo "The public link will appear below. Send that https://...trycloudflare.com URL to your professor."
npx --yes cloudflared tunnel --url http://127.0.0.1:3000
