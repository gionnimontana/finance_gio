# Scrapers

This folder groups the shared scraping runtime and the vendor adapters used to fetch live market data, KID-derived ETF risk indicators, or deterministic fixture values during e2e runs, including fetch-only providers for stable quote APIs and browser-profile hardening for automation-sensitive pages.

## Files

- [index.js](./index.js): Re-exports the supported scraper adapters and the shared multi-scraper entry point used by both live and test-mode portfolio refreshes plus ISIN risk lookups, including provider fallback, worker-local page reuse, fetch-only API scrapers, browser-profile hardening for headless scrapes, and cache-aware runtime behavior.

## Subfolders

- [core/index.md](./core/index.md): Shared scraper helpers for provider fallback, bounded concurrency, worker-local page reuse, fetch-only API providers, cache TTLs, stale-value reuse, browser-profile hardening, and progress reporting.
- [vendors/index.md](./vendors/index.md): Site-specific scraper adapters for ETFs, crypto prices, wallet values, gold, and validator balances, all normalized to the shared provider contract.

## Related Docs

- [../../docs/scraper-runtime.md](../../docs/scraper-runtime.md): Cross-cutting runtime notes for provider ordering, stale-cache recovery, deterministic fixture coverage, and deploy tuning.
