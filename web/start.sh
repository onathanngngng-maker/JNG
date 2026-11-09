#!/bin/bash
set -e
cd "$(dirname "$0")"
export PATH="/Users/chunheing/Projects/paper-gen/.conda/bin:$PATH"
unset OPENROUTER_API_KEY OPENROUTER_MODEL OPENROUTER_MAX_TOKENS

if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Paper Gen is already running."
  echo "Open: http://localhost:3000"
  echo "To stop it, run: ./stop.sh"
  exit 0
fi

echo "Starting Paper Gen..."
echo "On this computer: http://localhost:3000"
echo "Press Control+C in this terminal to stop, or run ./stop.sh in another terminal."
npm run dev
