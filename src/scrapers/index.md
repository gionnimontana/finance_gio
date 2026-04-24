# Scrapers

This folder groups the shared scraping runtime and the vendor adapters used to fetch live market data.

## Files

- [index.js](./index.js): Re-exports the supported scraper adapters and the shared multi-scraper entry point.

## Subfolders

- [core/index.md](./core/index.md): Shared Puppeteer helpers for retries, cached values, and progress reporting.
- [vendors/index.md](./vendors/index.md): Site-specific scraper adapters for ETFs, crypto prices, wallet values, gold, and validator balances.