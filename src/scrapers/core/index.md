# Scraper Core

This folder contains the shared Puppeteer orchestration used by the vendor-specific scrapers, plus the deterministic test-mode runtime used by the e2e suite.

## Files

- [index.js](./index.js): Provides single-target and multi-target scraping helpers with retries, cached results, progress callbacks, and deterministic fixture-based execution when `PFB_TEST_MODE=1`.