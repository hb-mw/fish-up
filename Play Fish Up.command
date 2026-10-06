#!/bin/bash
# Double-click launcher (macOS): starts a local server for Fish Up! and opens it in your browser.
cd "$(dirname "$0")"
PORT=5173
if curl -s -o /dev/null -m 1 "http://localhost:$PORT/"; then
  open "http://localhost:$PORT/"
  exit 0
fi
# Prefer node (nvm-aware), fall back to python3.
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
if command -v node >/dev/null 2>&1; then
  echo "Starting Fish Up! with node on http://localhost:$PORT/  (close this window to stop)"
  exec node tools/serve.mjs --open --port "$PORT"
elif command -v python3 >/dev/null 2>&1; then
  echo "Starting Fish Up! with python3 on http://localhost:$PORT/  (close this window to stop)"
  (sleep 1; open "http://localhost:$PORT/") &
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
else
  echo "Neither node nor python3 was found. Install Node.js (https://nodejs.org) and run: npm start"
  read -r -p "Press Enter to close"
fi
