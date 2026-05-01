# Source

This folder contains the backend application logic for authentication, user data persistence, live market scraping, deterministic e2e test-mode scraping, and portfolio aggregation.

## Folders

- [api/index.md](./api/index.md): Per-user asset schema and historical portfolio data persistence.
- [auth/index.md](./auth/index.md): Password generation, user-folder lifecycle, and request authentication.
- [scrapers/index.md](./scrapers/index.md): Shared scraping runtime and vendor adapters for live market data, ordered provider fallback, TTL-based cache reuse, and deterministic scraper regression coverage.
- [scripts/index.md](./scripts/index.md): Higher-level backend business logic plus the deploy-time frontend release builder and the local e2e browser-runtime helper used to keep Playwright and Puppeteer assets available.