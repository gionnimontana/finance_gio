# Scraper Vendors

This folder contains source-specific scraping adapters that translate each upstream site into the shared scraper contract.

## Files

- [beaconchainScraper.js](./beaconchainScraper.js): Exposes beaconcha.in validator-balance providers using the shared selector-list parser contract.
- [etherScan.js](./etherScan.js): Builds Etherscan wallet-value providers using the shared selector-list parser contract.
- [goldPriceScraper.js](./goldPriceScraper.js): Resolves the current gold price per gram in EUR from goldpreis.de using table parsing backed by the shared provider contract.
- [justETFscraper.js](./justETFscraper.js): Resolves ETF quote values by ISIN from justETF through the site's quote API and derives synthetic risk indicators from the linked KID PDFs, both through the shared fetch-only provider path.
- [xeScraper.js](./xeScraper.js): Exposes XE crypto-to-EUR providers used as the last fallback source.
- [yahooFinance.js](./yahooFinance.js): Exposes Yahoo Finance crypto-to-EUR providers that hit the chart API first and fall back to page parsing only when needed.
- [youngPlatformScraper.js](./youngPlatformScraper.js): Builds the active crypto quote chain, preferring Yahoo Finance's API-first provider stack before Young Platform and XE.
