#!/bin/bash

# Personal Finance Bot - Deploy Script
# Pulls latest changes, copies frontend to nginx, and restarts the server

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SERVICE_NAME="finance-bot"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SERVICE_HEALTH_URL="http://127.0.0.1:8085/health"
DEPLOY_ROOT="$SCRIPT_DIR/.deploy"
FRONTEND_DEPLOY_DIR="${DEPLOY_ROOT}/view"
NGINX_CONFIG_SOURCE="$SCRIPT_DIR/finance.gingergio.it.nginx"
NGINX_CONFIG_OUTPUT="${DEPLOY_ROOT}/finance.gingergio.it.nginx"
NGINX_SITE_ROOT="/var/www/finance.gingergio.it"
NGINX_CONFIG_DEPLOY_PATH="${NGINX_SITE_ROOT}/finance.gingergio.it.nginx"

resolve_min_node_version() {
	node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); const spec = String((pkg.engines && pkg.engines.node) || '>=18.19.1'); const match = spec.match(/>=\s*([0-9]+(?:\.[0-9]+){0,2})/); process.stdout.write(match ? match[1] : '18.19.1');"
}

version_at_least() {
	local current="$1"
	local required="$2"

	node -e "const parse = (value) => value.split('.').map((part) => Number(String(part).replace(/[^0-9].*$/, '') || 0)); const current = parse('${current}'); const required = parse('${required}'); for (let index = 0; index < 3; index += 1) { if ((current[index] || 0) > (required[index] || 0)) process.exit(0); if ((current[index] || 0) < (required[index] || 0)) process.exit(1); } process.exit(0);"
}

echo "📥 Pulling latest changes..."
git pull origin main

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
	echo "❌ Node.js is not installed or not available on PATH" >&2
	exit 1
fi

CURRENT_NODE_VERSION="$($NODE_BIN -p "process.versions.node")"
MIN_NODE_VERSION="$(resolve_min_node_version)"

if ! version_at_least "$CURRENT_NODE_VERSION" "$MIN_NODE_VERSION"; then
	echo "❌ Node ${MIN_NODE_VERSION}+ is required, but PATH resolves node to ${CURRENT_NODE_VERSION} (${NODE_BIN})" >&2
	echo "Install a newer Node.js version and ensure the deploy shell resolves it before rerunning deploy.sh" >&2
	exit 1
fi

echo "🧮 Using Node runtime: ${NODE_BIN} (v${CURRENT_NODE_VERSION})"

echo "📦 Installing dependencies..."
npm install

echo "🏷️  Building versioned frontend release..."
npm run build:frontend:release
echo "🧾 Copying nginx config into deploy artifact..."
mkdir -p "$DEPLOY_ROOT"
cp "$NGINX_CONFIG_SOURCE" "$NGINX_CONFIG_OUTPUT"
FRONTEND_VERSION="$(tr -d '\n' < .deploy/frontend-version.txt)"
echo "🌐 Frontend release version: ${FRONTEND_VERSION}"

echo "🧩 Installing system packages for Puppeteer..."
sudo apt-get update
sudo apt-get install -y \
	libatk-bridge2.0-0 libatk1.0-0 libcups2 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
	libxss1 libxtst6 libnss3 libasound2t64 libpangocairo-1.0-0 libpango-1.0-0 \
	libgtk-3-0 libgbm1 libdrm2 libxshmfence1

echo "📂 Deploying frontend to nginx..."
sudo mkdir -p "$NGINX_SITE_ROOT"
sudo rsync -a --delete "${FRONTEND_DEPLOY_DIR}/" "${NGINX_SITE_ROOT}/"
sudo install -m 0644 "$NGINX_CONFIG_OUTPUT" "$NGINX_CONFIG_DEPLOY_PATH"
sudo chown -R www-data:www-data "$NGINX_SITE_ROOT"

echo "🛠️  Ensuring systemd service exists..."
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Personal Finance Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=$SCRIPT_DIR
ExecStart=$NODE_BIN $SCRIPT_DIR/server/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PFB_SCRAPER_CONCURRENCY=1
Environment=PFB_SCRAPER_TIMEOUT_MS=12000
Environment=PFB_SCRAPER_SELECTOR_TIMEOUT_MS=8000
Environment=PFB_SCRAPER_ETF_TIMEOUT_MS=14000
Environment=PFB_SCRAPER_ETF_SELECTOR_TIMEOUT_MS=9000
Environment=PFB_SCRAPER_GOLD_TIMEOUT_MS=10000
Environment=PFB_SCRAPER_GOLD_SELECTOR_TIMEOUT_MS=7000
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "🔄 Reloading systemd and restarting service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME" >/dev/null
sudo systemctl restart "$SERVICE_NAME"

echo "🩺 Verifying backend health on ${SERVICE_HEALTH_URL}..."
for attempt in {1..15}; do
	if curl --fail --silent --show-error "$SERVICE_HEALTH_URL" | grep -q '"ok":true'; then
		echo "✅ Backend health check passed"
		break
	fi

	if [[ "$attempt" -eq 15 ]]; then
		echo "❌ Backend failed health check after restart" >&2
		sudo systemctl --no-pager --full status "$SERVICE_NAME" || true
		sudo journalctl -u "$SERVICE_NAME" -n 80 --no-pager || true
		exit 1
	fi

	sleep 2
done

echo "✅ Service restarted successfully"
echo "📄 Logs: journalctl -u $SERVICE_NAME -f"
