# Copilot Instructions for Personal Finance Bot

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
├── dashboard.html         # Main frontend dashboard (Networth)
├── history.html           # Historical portfolio view
├── chart.js               # Pie chart module for portfolio visualization
├── historyChart.js        # Column chart module for history view
├── src/
│   ├── api/
│   │   └── index.js       # Asset schema + historical data definitions
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

## Key Concepts

### Asset Schema
Assets are defined as arrays with 5 elements:
```javascript
[assetClass, assetId, quantity, displayName, viewGroup]
```
- `assetClass`: Category for scraping logic ('Equity', 'Crypto', 'Commodities', 'Liquidity')
- `assetId`: Unique identifier (ISIN for ETFs, symbol for crypto)
- `quantity`: Number of units owned
- `displayName`: Human-readable name for UI
- `viewGroup`: Category for UI grouping (can differ from assetClass)

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
- Keep chart logic in separate modules (`chart.js`, `historyChart.js`)
- Use consistent `.nav_link` class for all navigation/action buttons

History page notes:
- `3-Month Change` is computed vs the value 3 months earlier (not vs the first datapoint)

## Common Tasks

### Adding a New Asset
1. Add entry to `src/api/index.js` with correct assetClass and viewGroup
2. If new assetClass, create scraper in `src/scrapers/vendors/`
3. Export scraper in `src/scrapers/index.js`
4. Add scraper logic to `src/scripts/portfolio/index.js`

### Adding Historical Data
Add monthly snapshot to `getHistoricalData()` in `src/api/index.js`

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
