# Server

This folder contains the backend application logic for authentication, user data persistence, live market scraping, deterministic e2e test-mode scraping, and portfolio aggregation.

## Direct Files

- [index.js](./index.js): Express bootstrap that loads environment variables, hydrates the shared `data/isinRiskCache.json`, `data/cryptoRiskCache.json`, and `data/goldRiskCache.json` indicator caches into the scraper runtime on startup, serves the frontend, preserves permissive local/file-based API access with a small built-in CORS middleware, redirects root and unknown non-asset app URLs to the login entrypoint, exposes auth, account-deletion, assets-schema, view-group and color updates, per-user Other-asset risk-overrides, generic asset-risk-indicator plus legacy ISIN-risk APIs, and provides the health endpoint used by local automation.

## Folders

- [api/index.md](./api/index.md): Per-user asset schema and historical portfolio data persistence, including the guard that keeps current-month history pinned to the last fully successful refresh when live scrapes are partial.
- [auth/index.md](./auth/index.md): Password generation, user-folder lifecycle, and request authentication.
- [scrapers/index.md](./scrapers/index.md): Shared scraping runtime and vendor adapters for live market data, ordered provider fallback, TTL-based cache reuse, and deterministic scraper regression coverage.
- [scripts/index.md](./scripts/index.md): Higher-level backend business logic plus the deploy-time frontend release builder, SSH deploy helpers for the remote host, and the local e2e browser-runtime helper used to keep Playwright and Puppeteer assets available.

## Related Docs

- [../docs/data-model.md](../docs/data-model.md): Password-derived user identity, persisted schema/history files, and cache invalidation rules shared with the frontend.
- [../docs/frontend-cache.md](../docs/frontend-cache.md): Production route ownership, static cache policy, and deploy/runtime verification behavior.
- [../docs/scraper-runtime.md](../docs/scraper-runtime.md): Provider fallback, fetch-only runtime behavior, and low-memory scraper tuning.
