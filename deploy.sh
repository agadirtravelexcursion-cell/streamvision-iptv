#!/bin/bash
# ===== StreamVision IPTV — Auto-Deploy Script =====
# Serves the app on localhost and opens the browser

APP_DIR="$HOME/iptv-webapp"
PORT=8080

# Colors
GREEN='\033[0;32m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════╗"
echo "║   StreamVision IPTV — Auto Deploy   ║"
echo "╚══════════════════════════════${NC}"

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
  echo "❌ App directory not found: $APP_DIR"
  exit 1
fi

# Kill any existing server on the port
EXISTING=$(lsof -ti :$PORT 2>/dev/null)
if [ -n "$EXISTING" ]; then
  echo -e "${CYAN}→ Killing existing server on port $PORT...${NC}"
  kill $EXISTING 2>/dev/null
  sleep 1
fi

# Start the server
cd "$APP_DIR"
echo -e "${CYAN}→ Starting server on port $PORT...${NC}"
python3 -m http.server $PORT &>/dev/null &
SERVER_PID=$!
sleep 2

# Check if server started
if kill -0 $SERVER_PID 2>/dev/null; then
  echo -e "${GREEN}✅ Server running!${NC}"
  echo ""
  echo -e "  🌐 Local:   ${CYAN}http://localhost:${PORT}${NC}"
  echo -e "  🌐 Network: ${CYAN}http://$(hostname -I | awk '{print $1}'):${PORT}${NC}"
  echo ""
  echo -e "  PID: $SERVER_PID"
  echo ""
  echo -e "${PURPLE}Press Ctrl+C to stop${NC}"

  # Try to open browser
  if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:$PORT" &>/dev/null &
  elif command -v cmd.exe &>/dev/null; then
    cmd.exe /c start "http://localhost:$PORT" &>/dev/null &
  fi

  # Wait for Ctrl+C
  wait $SERVER_PID
else
  echo "❌ Failed to start server"
  exit 1
fi
