# Billy Tracker 🕵

A personal finance tracker that scrapes live asset prices, stores per-user portfolio data, and serves a small browser UI for portfolio, history, and asset management.

## What It Includes

- Node.js + Express backend
- Puppeteer-based price scraping
- Vanilla HTML/CSS/JavaScript frontend
- Per-user JSON storage under `data/users/`

## Run Locally

```bash
npm install
node server.js
```

The app runs on `http://localhost:8085`

## Use The App

1. Navigate to `http://localhost:8085/login/`
2. Generate a new password or enter an existing one
3. Add your assets in the Assets page
4. View your portfolio on the Dashboard

## Codebase Entry Points

- `src/index.md`: backend navigation
- `view/index.md`: frontend navigation
- Follow the nested `index.md` files inside those folders for more detailed module-level docs

## Working In This Repo

- Keep source changes and markdown docs in sync.
- When you add, remove, rename, or repurpose files or folders under `src/` or `view/`, update the affected `index.md` files in the same change.
- Keep file-scope comments and missing JSDoc up to date when editing JS source files.

