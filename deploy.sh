#!/bin/bash

# Personal Finance Bot - Deploy Script
# Pulls latest changes, copies frontend to nginx, and restarts the server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SERVICE_NAME="finance-bot"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "📥 Pulling latest changes..."
git pull origin main

echo "📦 Installing dependencies..."
npm install

echo "📂 Deploying frontend to nginx..."
sudo rm -rf /var/www/finance.gingergio.it/*
sudo mkdir -p /var/www/finance.gingergio.it
sudo cp -r view/* /var/www/finance.gingergio.it/
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
