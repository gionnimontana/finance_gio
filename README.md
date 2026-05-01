# Billy Tracker 🕵

A personal finance tracker that scrapes live asset prices, stores per-user portfolio data, and serves a small browser UI for portfolio, history, and asset management.

## What It Includes

- Node.js + Express backend
- Puppeteer-based price scraping
- Vanilla HTML/CSS/JavaScript frontend
- Per-user JSON storage under `data/users/`
- Playwright end-to-end coverage for the full browser flow

## Run Locally

Use Node.js 18.19.1 or newer.
On Apple Silicon, use an arm64 Node build. An x64 Node binary running through Rosetta can make the Puppeteer-backed scraper tests much slower and will emit degraded-performance warnings.

```bash
nvm use
npm install
npm start
```

The app runs on `http://localhost:8085`

## End-To-End Tests

The repository now includes a deterministic full-stack e2e harness under `tests/e2e/`.

- `npm run test:e2e:smoke`: fast smoke coverage used by the local `pre-commit` hook
- `npm run test:e2e`: full Playwright suite against the real Express server and frontend
- `npm run test:e2e:headed`: headed Playwright run for local debugging

The tests boot the real application in a dedicated test mode:

- live scrapers are replaced with deterministic fixture values
- user data is written to `tests/e2e/.runtime/` instead of `data/`
- the browser still exercises the real login, dashboard, history, and settings flows end to end

Install both browser runtimes once after `npm install`, or let the e2e scripts do it for you automatically:

```bash
npm run browsers:install
```

If you ran `npm install` before switching this repo to Node 18.19.1+, rerun `npm run browsers:install`. Puppeteer 24 stores its Chrome binary separately from Playwright under `~/.cache/puppeteer`.

## Commit And CI Automation

- `pre-commit` runs `npm run test:e2e:smoke`
- GitHub Actions runs the full e2e suite on pushes to `main` and on pull requests

## Use The App

1. Navigate to `http://localhost:8085/login/`
2. Generate a new password or enter an existing one
3. Add your assets in the Assets page
4. View your portfolio on the Dashboard

## Codebase Entry Points

- `server/index.md`: backend navigation
- `view/index.md`: frontend navigation
- `docs/index.md`: project wiki for architecture, workflows, conventions, troubleshooting, and durable decisions
- Follow the nested `index.md` files inside those folders for more detailed module-level docs

## Working In This Repo

- Keep source changes and markdown docs in sync.
- When you add, remove, rename, or repurpose files or folders under `server/` or `view/`, update the affected `index.md` files in the same change.
- Update `docs/` when a change affects cross-cutting project knowledge that should outlive the immediate diff.
- Keep `server/` and `view/` `index.md` files focused on structure, and keep `docs/` focused on cross-cutting knowledge.
- Keep file-scope comments and missing JSDoc up to date when editing JS source files.

