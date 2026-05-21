# Scraper Core

This folder contains the shared browser and fetch orchestration used by the vendor-specific scrapers, plus the deterministic test-mode runtime used by the e2e suite.

## Files

- [index.js](./index.js): Provides single-target and multi-target scraping helpers with ordered provider fallback, bounded concurrency, retry backoff, lazy worker-local page reuse, fetch-only providers for JSON/API sources, TTL-based cache reuse with stale fallback, a stable non-headless browser profile for automation-sensitive browser scrapes, structured progress callbacks, deterministic fixture-based execution when `PFB_TEST_MODE=1`, and low-memory-safe defaults for deployed Linux hosts.