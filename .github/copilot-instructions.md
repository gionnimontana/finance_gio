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
│   ├── dashboard.html     # Main frontend dashboard (Networth)
│   ├── assets.html        # Assets management UI (CRUD assetsSchema)
│   ├── assets.js          # Assets management page logic
│   ├── history.html       # Historical portfolio view
│   ├── chart.js           # Pie chart module for portfolio visualization
│   └── historyChart.js    # Column chart module for history view
├── src/
│   ├── api/
│   │   └── index.js       # API logic for assets and historical data
│   ├── data/              # JSON data files
│   │   ├── assetsSchema.json    # Asset definitions and quantities
│   │   └── historicalData.json  # Historical portfolio snapshots
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

- `GET /portfolio?refresh=true|false` - Current portfolio data
- `GET /portfolio/history` - Historical monthly snapshots
- `GET /assets/schema` - Read assets schema
- `PUT /assets/schema` - Replace assets array in assets schema

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

### Historical Data Schema
Monthly snapshots with viewGroup totals:
```javascript
{ label, date, total, Liquidity: { total }, Crypto: { total }, Gold: { total }, Houses: { total }, Equity: { total } }
```

### View Groups
Used for UI display and charts: Liquidity, Crypto, Gold, Houses, Equity

History chart stacking order (bottom → top): Liquidity → Crypto → Gold → Houses → Equity

## Coding Guidelines

### Scrapers
- Always implement retry logic with configurable max retries
- Close browser pages in both success and error paths
- Use cached values when scraping fails
- Track failures and report them to the frontend

### Frontend
- Use localStorage for caching portfolio data
- Show cached data immediately while refreshing
- Display error banner when scrapers fail
- Keep chart logic in separate modules (`view/chart.js`, `view/historyChart.js`)
- Use consistent `.nav_link` class for all navigation/action buttons

History page notes:
- `3-Month Change` is computed vs the value 3 months earlier (not vs the first datapoint)

## Common Tasks

### Adding a New Asset
1. Add entry to `src/data/assetsSchema.json` with correct assetClass and viewGroup
2. If new assetClass, create scraper in `src/scrapers/vendors/`
3. Export scraper in `src/scrapers/index.js`
4. Add scraper logic to `src/scripts/portfolio/index.js`

### Adding Historical Data
Add monthly snapshot to `src/data/historicalData.json` (or let the app auto-update it)

## Running the App

```bash
# Install dependencies
npm install

# Start server
node server.js

# Access dashboard
open http://localhost:8085/dashboard.html
```

## Environment Variables

Uses `.env` file for configuration (loaded via dotenv).
