# Docs Log

This file is an append-only history of notable wiki updates.

Use one heading per entry:

```md
## [YYYY-MM-DD] update | Short title
- What changed.
- Why it mattered.
```

Supported labels are `bootstrap`, `update`, `query`, and `lint`.

## [2026-04-24] bootstrap | Create docs wiki
- Added the initial `docs/` wiki shell with `index.md`, `schema.md`, and `log.md`.
- Defined `docs/` as the home for cross-cutting project knowledge rather than code-structure inventory.

## [2026-04-30] update | Document data model and cache invalidation
- Added a `docs/data-model.md` topic page that explains password-derived user storage, persisted JSON files, browser-local cache usage, and the requirement for a shared backend when using multiple devices.
- Recorded the dashboard schema-cache invalidation behavior so cross-session asset edits are easier to reason about and troubleshoot.

## [2026-04-30] update | Document scraper fallback runtime
- Added a `docs/scraper-runtime.md` topic page describing ordered provider fallback, cache TTL and stale-value reuse, and the deterministic scraper regression suite.
- Updated the scraper and portfolio structural docs so the new runtime contract and refresh normalization are discoverable from the markdown entry points.

## [2026-05-01] update | Document low-memory scraper tuning
- Extended `docs/scraper-runtime.md` with the deployment guidance for low-memory Linux servers, including the new production scraper env vars and the specific timeout pressure affecting justETF and gold scrapes.
- Updated the scraper core structural doc so the low-memory runtime behavior is discoverable from the backend entry point.

## [2026-05-01] update | Document scraper page reuse
- Updated `docs/scraper-runtime.md` with the worker-local page reuse behavior now used by live scrapes to reduce repeated Puppeteer setup cost on small VPS hosts.
- Refreshed the scraper structural docs so the runtime optimization is discoverable from the backend and docs entry points.

## [2026-05-01] update | Document frontend cache-busting deploy flow
- Added `docs/frontend-cache.md` to capture the production frontend caching strategy: HTML shells always revalidate, JS and CSS URLs are versioned during deploy, and only exact API routes proxy to Express.
- Updated the backend and frontend structural docs so the generated release build and Nginx-owned static cache policy are discoverable from the project entry points.
