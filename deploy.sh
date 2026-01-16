#!/bin/bash

# Personal Finance Bot - Deploy Script
# Pulls latest changes, copies frontend to nginx, and restarts the server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📥 Pulling latest changes..."
git pull origin main

echo "📦 Installing dependencies..."
npm install

echo "📂 Deploying frontend to nginx..."
sudo rm -rf /var/www/finance.gingergio.it/*
sudo mkdir -p /var/www/finance.gingergio.it
sudo cp -r view/* /var/www/finance.gingergio.it/
sudo chown -R www-data:www-data /var/www/finance.gingergio.it

echo "🔄 Restarting server..."
# Kill existing node process if running
pkill -f "node server.js" 2>/dev/null || true

# Start server in background
nohup node server.js > server.log 2>&1 &

echo "✅ Server restarted successfully (PID: $!)"
echo "📄 Logs: tail -f $SCRIPT_DIR/server.log"
