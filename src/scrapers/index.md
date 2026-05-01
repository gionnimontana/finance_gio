# Scrapers

This folder groups the shared scraping runtime and the vendor adapters used to fetch live market data or deterministic fixture values during e2e runs.

## Files

- [index.js](./index.js): Re-exports the supported scraper adapters and the shared multi-scraper entry point used by both live and test-mode portfolio refreshes, including provider fallback, worker-local page reuse, and cache-aware runtime behavior.

## Subfolders

- [core/index.md](./core/index.md): Shared Puppeteer helpers for provider fallback, bounded concurrency, page reuse, cache TTLs, stale-value reuse, and progress reporting.
- [vendors/index.md](./vendors/index.md): Site-specific scraper adapters for ETFs, crypto prices, wallet values, gold, and validator balances, all normalized to the shared provider contract.