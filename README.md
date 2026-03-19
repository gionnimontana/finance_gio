# Billy Tracker 🕵

A financial asset tracker that scrapes real-time asset prices and displays an interactive dashboard with portfolio visualization.

## Features

- 📊 **Real-time Price Scraping** - Fetches live prices for ETFs, crypto, gold, and more
- 💼 **Multi-Asset Support** - Track stocks, ETFs, cryptocurrencies, gold, and custom assets
- 📈 **Portfolio Dashboard** - Interactive pie chart visualization of your holdings
- 📅 **Historical Tracking** - Monthly snapshots with column charts showing portfolio growth
- 🔐 **Multi-User Support** - Secure password-based authentication (5-word Italian passphrase)
- ⚡ **Live Updates** - SSE-powered real-time refresh with progress indicators

## Tech Stack

- **Backend**: Node.js with Express
- **Web Scraping**: Puppeteer (headless browser automation)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Data Storage**: JSON files with in-memory caching

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/personal-finance-bot.git
cd personal-finance-bot

# Install dependencies
npm install

# Start the server
node server.js
```

The app runs on `http://localhost:8085`

## Usage

1. Navigate to `http://localhost:8085/login/`
2. Generate a new password or enter an existing one
3. Add your assets in the Assets page
4. View your portfolio on the Dashboard

## Asset Types

| Asset Class | Description | Example ID |
|-------------|-------------|------------|
| `Isin` | ETFs and stocks | `IE00B4L5Y983` |
| `Crypto` | Cryptocurrencies | `BTC`, `ETH` |
| `Gold` | Gold holdings | `gold-gram` |
| `Other` | Custom assets | Any identifier |

## API Endpoints

### Public
- `POST /auth/generate` - Generate new password (globally limited to 5 successful account creations every 30 minutes per app instance; returns `429` with `retryAfterSeconds` when saturated)
- `POST /auth/validate` - Validate existing password

### Protected (requires `X-User-Password` header)
- `GET /portfolio` - Current portfolio data
- `GET /portfolio/stream` - SSE endpoint for live updates
- `GET /portfolio/history` - Historical snapshots
- `GET /assets/schema` - Get assets configuration
- `PUT /assets/schema` - Update assets
- `PUT /assets/view-groups` - Update view groups

## Project Structure

```
├── server.js              # Express server entry point
├── view/                  # Frontend pages
│   ├── commons/           # Shared styles and utilities
│   ├── login/             # Authentication page
│   ├── dashboard/         # Main portfolio view
│   ├── assets/            # Asset management
│   └── history/           # Historical data view
├── data/users/            # Per-user JSON data storage
└── src/
    ├── api/               # API logic
    ├── auth/              # Authentication
    ├── scrapers/          # Price scraping modules
    └── scripts/           # Portfolio calculations
```

## Environment Variables

Create a `.env` file for configuration (loaded via dotenv).

## Deployment Notes

- The app is served from the root of the subdomain (e.g. https://finance.gingergio.it/).
- Nginx can serve the frontend from `/var/www/finance.gingergio.it` and proxy API requests to port 8085.
- `deploy.sh` copies `view/` into `/var/www/finance.gingergio.it` after pull.

## Operational Notes

- `POST /auth/generate` uses an in-memory rolling window and allows at most 5 successful account creations every 30 minutes on a single Node.js instance.
- The account-creation limiter resets on process restart because it is intentionally instance-local and does not use shared storage.

## License

MIT
