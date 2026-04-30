# Scraper Core

This folder contains the shared Puppeteer orchestration used by the vendor-specific scrapers, plus the deterministic test-mode runtime used by the e2e suite.

## Files

- [index.js](./index.js): Provides single-target and multi-target scraping helpers with ordered provider fallback, bounded concurrency, retry backoff, TTL-based cache reuse with stale fallback, structured progress callbacks, and deterministic fixture-based execution when `PFB_TEST_MODE=1`.