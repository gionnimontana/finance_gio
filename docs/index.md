# Docs

This folder contains the LLM-maintained project wiki for cross-cutting knowledge that is useful beyond a single code diff.

## Files

- [data-model.md](./data-model.md): Cross-cutting notes about password-derived user storage, the shared `isinRiskCache.json`, `cryptoRiskCache.json`, and `goldRiskCache.json` files, `assetsSchema.riskOverrides` for `Other` assets, persisted `viewGroupColors`, account deletion, view-group ordering, schema-cache invalidation, failed-refresh cache preservation, last-successful refresh baselines, browser-local caches and what logout clears, per-view-group history buckets, and cross-device synchronization behavior.
- [shared-risk-caches.md](./shared-risk-caches.md): Shared on-disk cache notes for ISIN, crypto, and gold risk indicators, including data-root file locations, startup hydration, atomic rewrite behavior, best-effort persistence, and account-deletion boundaries.
- [portfolio-metrics.md](./portfolio-metrics.md): Durable notes about dashboard ATH behavior and mood bands, history title mood rules, saved-history summary baselines, and the browser-persisted last-refresh total baseline used by dashboard performance summaries.
- [deploy-runtime.md](./deploy-runtime.md): Production deploy and runtime notes covering Nginx ownership of static pages and cache-control, unknown-route redirect ownership, the shared cold-boot loading overlay that masks auth handoffs on uncached page loads, live activation through Nginx reloads, the env-backed site server-block template, deploy-time asset versioning, domain-based backend health verification, the local SSH helpers, and the exact backend routes that still proxy to Express, including the asset-risk and account-deletion APIs.
- [scraper-runtime.md](./scraper-runtime.md): Fallback-provider runtime notes covering fetch-only API providers, KID-derived ETF risk scraping, issuer-domain-aware direct WisdomTree KID fallbacks, computed crypto and gold risk scoring from Yahoo Finance history (lookbacks, annualization, and thresholds), lazy page startup, browser-profile hardening for automation-sensitive sites, fresh and stale cache TTLs, stale-value reuse, best-effort shared cache persistence, and deterministic scraper regression tests including the `node:test` server suite.
- [auth-security.md](./auth-security.md): Password-as-identity model, generated-password entropy, unsalted hash folder names, header auth including the SSE stream, rate limits, CORS, and which browser keys logout clears.
- [portfolio-refresh.md](./portfolio-refresh.md): `/portfolio` versus `/portfolio/stream`, SSE event payloads, which dashboard path uses each, fallback rules, and when history and summary baselines are written.
- [risk-indicators.md](./risk-indicators.md): Risk badge families and payload, `Other` defaults and overrides, weighted dashboard averages, and how computed crypto/gold scores differ from the regulatory PRIIPs SRI.
- [configuration.md](./configuration.md): Every environment variable read by the server, scraper runtime, tests, and deploy helpers, with defaults.
- [testing.md](./testing.md): Server `node:test` and Playwright suites, test-mode isolation, fixtures, pre-commit hook, and CI.
- [log.md](./log.md): Append-only history of notable wiki updates.
- [schema.md](./schema.md): Minimal format and maintenance rules for wiki pages.

## What Belongs Here

- Architecture notes that span backend and frontend folders.
- Contributor workflows, conventions, and troubleshooting guidance.
- Durable decisions, non-obvious behavior, and other project knowledge worth keeping current.

## What Stays Elsewhere

- [../server/index.md](../server/index.md) and [../view/index.md](../view/index.md) remain the structural entry points for backend and frontend code.
- Folder inventories, file-level behavior, and implementation details should stay in source, comments, JSDoc, or the folder-level `index.md` files unless a cross-cutting wiki page is needed.

## Next Topic Pages

Create a new page in this folder only when the topic will remain useful after the immediate task is done. Start by updating an existing page whenever possible.
