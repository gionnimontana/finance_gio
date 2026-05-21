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

## [2026-05-01] update | Exclude markdown from generated frontend release
- Updated the frontend release build so `.deploy/view/` omits source markdown navigation docs and contains only deployable frontend files.
- Refreshed the cache/deploy docs so contributors know the `view/` markdown pages stay in source control only and should not be edited in generated output.

## [2026-05-01] update | Rename backend root folder to server
- Renamed the top-level backend folder from `src/` to `server/`, including the Express entrypoint, nested backend modules, and structural navigation docs.
- Updated runtime config, tests, contributor instructions, and wiki links so backend references now resolve through `server/index.md`.

## [2026-05-01] update | Document deploy runtime verification
- Updated `docs/frontend-cache.md` with the deploy-time Node-runtime pinning and post-restart backend health probe that now guard the systemd-managed API service.
- Refreshed `docs/index.md` so the deployment troubleshooting notes are discoverable from the docs entry point.

## [2026-05-01] update | Document headless scraper hardening
- Updated `docs/scraper-runtime.md` with the justETF regression where headless Chromium stopped receiving quote text unless the runtime masked obvious automation signals.
- Refreshed the scraper structural docs so the shared browser-profile hardening and new regression coverage are discoverable from the backend and docs entry points.

## [2026-05-01] update | Switch justETF to quote API
- Updated `docs/scraper-runtime.md` with the justETF quote API path now used in live refreshes, replacing the flaky rendered quote shell for ETF prices.
- Refreshed the scraper structural docs so the shared fetch-only provider path and the justETF API-based ETF scraper are discoverable from the backend and docs entry points.

## [2026-05-21] update | Cross-link metrics and state docs
- Added `docs/portfolio-metrics.md` to define the dashboard ATH baseline, the history title-mood rule, and the persisted summary baselines derived from saved history.
- Expanded `docs/data-model.md` and the structural entry points so state-model, deploy-runtime, scraper-runtime, and portfolio-metrics pages are easier to discover from the README and folder navigation docs.

## [2026-05-21] update | Raise Node runtime baseline
- Updated the repo runtime pins, contributor instructions, and CI workflow from Node 18.19.1 to Node 24.15.0 so local installs, deploys, and e2e automation share the same supported floor.
- Refreshed the deploy/runtime wiki guidance because Puppeteer 25.x now depends on a newer Node baseline than the repo used previously.
