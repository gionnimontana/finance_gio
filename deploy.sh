#!/bin/bash

# Personal Finance Bot - Deploy Script
# Pulls latest changes, copies frontend to nginx, and restarts the server

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SERVICE_NAME="finance-bot"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "📥 Pulling latest changes..."
git pull origin main

echo "📦 Installing dependencies..."
npm install

echo "🧩 Installing system packages for Puppeteer..."
sudo apt-get update
sudo apt-get install -y \
	libatk-bridge2.0-0 libatk1.0-0 libcups2 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
	libxss1 libxtst6 libnss3 libasound2 libpangocairo-1.0-0 libpango-1.0-0 \
	libgtk-3-0 libgbm1 libdrm2 libxshmfence1

echo "📂 Deploying frontend to nginx..."
sudo mkdir -p /var/www/finance.gingergio.it
sudo rsync -a --delete view/ /var/www/finance.gingergio.it/
sudo chown -R www-data:www-data /var/www/finance.gingergio.it

echo "🛠️  Ensuring systemd service exists..."
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Personal Finance Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=$SCRIPT_DIR
ExecStart=/usr/bin/node $SCRIPT_DIR/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "🔄 Reloading systemd and restarting service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME" >/dev/null
sudo systemctl restart "$SERVICE_NAME"

echo "✅ Service restarted successfully"
echo "📄 Logs: journalctl -u $SERVICE_NAME -f"
