# Scraper Vendors

This folder contains source-specific scraping adapters that translate each upstream site into the shared scraper contract.

## Files

- [beaconchainScraper.js](./beaconchainScraper.js): Exposes beaconcha.in validator-balance providers using the shared selector-list parser contract.
- [cryptoRiskScraper.js](./cryptoRiskScraper.js): Builds fetch-first 1-7 crypto risk-score providers from Yahoo Finance daily history, using fixed volatility and drawdown buckets plus isolated cache keys.
- [etherScan.js](./etherScan.js): Builds Etherscan wallet-value providers using the shared selector-list parser contract.
- [goldPriceScraper.js](./goldPriceScraper.js): Resolves the current gold price per gram in EUR from goldpreis.de using table parsing backed by the shared provider contract.
- [goldRiskScraper.js](./goldRiskScraper.js): Builds fetch-first 1-7 physical-gold risk-score providers from Yahoo Finance gold-futures history, using the same volatility and drawdown bucket model as crypto plus isolated cache keys.
- [justETFscraper.js](./justETFscraper.js): Resolves ETF quote values by ISIN from justETF through the site's quote API and derives synthetic risk indicators from either justETF-linked KID PDFs or issuer-hosted PRIIP KIDs, including a direct WisdomTree dataspan fallback for products whose issuer HTML page blocks server-side fetches, while keeping the quote path fetch-first.
- [marketRisk.js](./marketRisk.js): Shared volatility, drawdown, and bucket-scoring helpers reused by the non-ISIN risk scorers.
- [xeScraper.js](./xeScraper.js): Exposes XE crypto-to-EUR providers used as the last fallback source.
- [yahooFinance.js](./yahooFinance.js): Exposes Yahoo Finance crypto-to-EUR providers that hit the chart API first and fall back to page parsing only when needed, plus reusable history-fetch helpers consumed by the crypto risk scorer.
- [youngPlatformScraper.js](./youngPlatformScraper.js): Builds the active crypto quote chain, preferring Yahoo Finance's API-first provider stack before Young Platform and XE.
