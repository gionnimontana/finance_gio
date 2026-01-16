# Copilot Instructions for Personal Finance Bot

## ⚠️ Instruction Maintenance

After ANY codebase modification, review and update this file:
- Add new files, endpoints, schemas, or patterns
- Remove references to deleted/renamed items
- Keep examples accurate and minimal
- No verbose explanations—be concise

## Project Overview

This is a personal finance portfolio tracker application that:
- Scrapes real-time asset prices from various sources (ETFs, crypto, gold)
- Aggregates portfolio data and calculates totals
- Displays a web dashboard with portfolio overview and pie chart visualization
- Shows historical portfolio data with column charts

## Tech Stack

- **Backend**: Node.js with Express (port 8085)
- **Web Scraping**: Puppeteer for headless browser automation
- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework)
- **Data Storage**: In-memory caching with localStorage on frontend

## Project Structure

```
├── server.js              # Express server entry point
├── view/                  # Frontend files
│   ├── commons/           # Shared resources across all pages
│   │   ├── styles.css     # Common CSS classes (body, nav, banners, buttons, tables)
│   │   └── utils.js       # Common JS utilities (API_BASE, authFetch, t(), pct(), el(), etc.)
│   ├── login/             # Login/authentication page
│   │   ├── index.html     # Login page
│   │   ├── styles.css     # Login-specific styles
│   │   └── script.js      # Login/generate password logic
│   ├── dashboard/         # Main dashboard (Networth)
│   │   ├── index.html     # Dashboard page
│   │   ├── styles.css     # Dashboard-specific styles (overview, progress banner)
│   │   ├── chart.js       # Pie chart module for portfolio visualization
│   │   └── script.js      # Dashboard logic (SSE refresh, rendering)
│   ├── assets/            # Assets management UI
│   │   ├── index.html     # Assets management page
│   │   ├── styles.css     # Assets-specific styles
│   │   └── script.js      # Assets CRUD logic
│   └── history/           # Historical portfolio view
│       ├── index.html     # History page
│       ├── styles.css     # History-specific styles (history table colors)
│       ├── chart.js       # Column chart module for history view
│       └── script.js      # History rendering logic
├── data/                  # JSON data files (per-user in data/users/{hash}/)
│   └── users/             # User-specific data folders (named by password hash)
│       └── {hash}/        # Each user's data directory
│           ├── assetsSchema.json    # User's asset definitions
│           └── historicalData.json  # User's historical snapshots
├── src/
│   ├── auth/
│   │   └── index.js       # Authentication: password generation, hashing, middleware
│   ├── api/
│   │   └── index.js       # API logic for assets and historical data
│   ├── scrapers/
│   │   ├── core/
│   │   │   └── index.js   # Core scraping logic with retry and caching
│   │   ├── vendors/       # Individual scraper implementations
│   │   │   ├── justETFscraper.js      # ETF prices from justETF
│   │   │   ├── youngPlatformScraper.js # Crypto prices
│   │   │   ├── goldPriceScraper.js    # Gold prices from gold.de
│   │   │   └── ...
│   │   └── index.js       # Scraper exports
│   └── scripts/
│       └── portfolio/
│           └── index.js   # Portfolio calculation logic
```

## API Endpoints

### Authentication (no auth required)
- `POST /auth/generate` - Generate new 5-word Italian password, creates user folder
- `POST /auth/validate` - Validate password exists: `{ password }` → `{ valid: boolean }`

### Protected endpoints (require `X-User-Password` header)
- `GET /portfolio?refresh=true|false` - Current portfolio data
- `GET /portfolio/stream?password=...` - SSE endpoint (password in query param)
- `GET /portfolio/history` - Historical monthly snapshots
- `GET /assets/schema` - Read assets schema
- `PUT /assets/schema` - Replace assets array in assets schema
- `PUT /assets/view-groups` - Replace view groups list

## Key Concepts

### Asset Schema
Assets are defined as arrays with 5 elements:
```javascript
[assetClass, assetId, quantity, displayName, viewGroup]
```
- `assetClass`: Category for scraping logic (one of: `Isin`, `Crypto`, `Gold`, `Other`)
- `assetId`: Unique identifier (ISIN for ETFs, symbol for crypto)
- `quantity`: Number of units owned
- `displayName`: Human-readable name for UI
- `viewGroup`: Category for UI grouping/charts (e.g. Liquidity, Crypto, Gold, Houses, Equity)

Assets schema also contains a `viewGroups` array used to drive the Assets UI dropdown and grouping:
```json
{ "assets": [...], "viewGroups": ["Liquidity", "Crypto", "Gold", "Houses", "Equity"], "prevMonthTotal": null, "initYearNetworth": null }
```

### Historical Data Schema
Monthly snapshots with viewGroup totals:
```javascript
{ label, date, total, Liquidity: { total }, Crypto: { total }, Gold: { total }, Houses: { total }, Equity: { total } }
```

### View Groups
Used for UI display and charts: Liquidity, Crypto, Gold, Houses, Equity

History chart stacking order (bottom → top): Liquidity → Crypto → Gold → Houses → Equity

### Multi-User Authentication
- Each user has a unique password: 5 random Italian words joined by dashes (e.g. `casa-luna-libro-mare-sole`)
- Passwords are hashed (SHA-256) to create folder names in `data/users/{hash}/`
- No recovery mechanism - lost password = lost data
- Password stored in `localStorage.userPassword` on frontend
- Frontend uses `authFetch()` wrapper to add `X-User-Password` header
- SSE streams use password as query param (headers unreliable for SSE)

## Coding Guidelines

### Scrapers
- Always implement retry logic with configurable max retries
- Close browser pages in both success and error paths
- Use cached values when scraping fails
- Track failures and report them to the frontend
- `multipleUrlSelectorScraper` supports `onProgress` callback for streaming updates

### Frontend
- Use localStorage for caching portfolio data and user password
- All API calls use `authFetch()` from utils.js (adds X-User-Password header)
- Each protected page calls `requireAuth()` at start to redirect to login if needed
- Show cached data immediately while refreshing
- Display error banner when scrapers fail
- Ensure HTML pages include UTF-8 meta charset
- Common CSS in `view/commons/styles.css`, page-specific CSS in each route folder
- Common JS utilities in `view/commons/utils.js` (API_BASE, authFetch, getPassword, etc.)
- Each route has its own folder: `login/`, `dashboard/`, `assets/`, `history/`
- Use consistent `.nav_link` class for all navigation/action buttons
- Dashboard uses SSE (`EventSource`) for real-time refresh progress updates
- Progress banner shows: asset name, value, running portfolio delta vs prev month
- Old URLs (dashboard.html, assets.html, history.html) redirect to new folder structure

History page notes:
- `3-Month Change` is computed vs the value 3 months earlier (not vs the first datapoint)

## Common Tasks

### Adding a New Asset
1. Add entry to `data/assetsSchema.json` with correct assetClass and viewGroup
2. If new assetClass, create scraper in `src/scrapers/vendors/`
3. Export scraper in `src/scrapers/index.js`
4. Add scraper logic to `src/scripts/portfolio/index.js`

### Adding Historical Data
Add monthly snapshot to `data/historicalData.json` (or let the app auto-update it)

## Running the App

```bash
# Install dependencies
npm install

# Start server
node server.js

# Access login page (generates password or enter existing)
open http://localhost:8085/login/
```

## Deployment Notes

- App is served from the root of a subdomain (e.g. https://finance.gingergio.it/).
- Nginx serves the frontend from `/var/www/finance.gingergio.it` and proxies API requests to port 8085.
- `deploy.sh` copies `view/` into `/var/www/finance.gingergio.it` after pull.
- `deploy.sh` provisions a systemd service (`finance-bot`) for auto-restart and logs via journald.

## Environment Variables

Uses `.env` file for configuration (loaded via dotenv).
