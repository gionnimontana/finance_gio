# Docs

This folder contains the LLM-maintained project wiki for cross-cutting knowledge that is useful beyond a single code diff.

## Files

- [data-model.md](./data-model.md): Cross-cutting notes about password-derived user storage, the shared `isinRiskCache.json` file, account deletion, view-group ordering, schema-cache invalidation, browser-local caches, and cross-device synchronization behavior.
- [isin-risk-cache-plan.md](./isin-risk-cache-plan.md): Shared on-disk cache notes for KID-derived ISIN risk indicators, including the data-root file location, startup hydration flow, and atomic rewrite behavior.
- [portfolio-metrics.md](./portfolio-metrics.md): Durable notes about dashboard ATH behavior, history title mood rules, and the persisted summary baselines derived from saved history.
- [frontend-cache.md](./frontend-cache.md): Production frontend cache-control and deploy-runtime notes covering Nginx ownership of static pages, unknown-route redirect ownership, the shared cold-boot loading overlay that masks auth handoffs on uncached page loads, live activation through Nginx reloads, the env-backed site server-block template, deploy-time asset versioning, domain-based backend health verification, the local SSH helpers, and the exact backend routes that still proxy to Express.
- [scraper-runtime.md](./scraper-runtime.md): Fallback-provider runtime notes covering fetch-only API providers, KID-derived ETF risk scraping with issuer-page fallbacks, lazy page startup, browser-profile hardening for automation-sensitive sites, cache TTLs, stale-value reuse, and deterministic scraper regression tests.
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
