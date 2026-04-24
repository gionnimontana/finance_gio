# Scraper Vendors

This folder contains source-specific scraping adapters that translate each upstream site into the shared scraper contract.

## Files

- [beaconchainScraper.js](./beaconchainScraper.js): Scrapes adjusted validator balances from beaconcha.in.
- [etherScan.js](./etherScan.js): Builds wallet-holdings scraper configs backed by Etherscan.
- [goldPriceScraper.js](./goldPriceScraper.js): Resolves the current gold price per gram in EUR from goldpreis.de.
- [justETFscraper.js](./justETFscraper.js): Resolves ETF quote values by ISIN from justETF.
- [xeScraper.js](./xeScraper.js): Resolves crypto-to-EUR exchange rates from XE.
- [yahooFinance.js](./yahooFinance.js): Resolves crypto-to-EUR quotes from Yahoo Finance.
- [youngPlatformScraper.js](./youngPlatformScraper.js): Resolves crypto-to-EUR prices from Young Platform.