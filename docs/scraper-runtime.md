# Scraper Runtime

This page captures the cross-cutting scraper behavior that matters beyond a single code diff.

## Current State
- The shared runtime in `server/scrapers/core/index.js` normalizes each asset into an ordered provider chain instead of a single scraper target, providers can now resolve values either through browser automation or direct HTTP fetches, and the same in-memory cache can now be preloaded from the shared `data/isinRiskCache.json` file on server startup.
- Live refreshes reuse one Puppeteer browser per pass, create worker-local pages lazily only when a provider actually needs browser automation, apply a stable non-headless browser profile before navigation when needed, scrape with bounded concurrency, retry provider-local failures with backoff, and can reuse stale cached values when every live provider fails.
- Crypto quotes now prefer Yahoo Finance's chart API first, then fall back to the Yahoo quote page, Young Platform, and XE. ETF, gold, validator, and wallet scrapers use the same provider contract even where only one upstream exists today, and ISIN-based synthetic risk indicators now reuse that runtime with justETF profile discovery plus fundinfo KID PDF parsing.
- Low-memory hosts automatically fall back to safer scraper defaults, and the deployment script pins the production service to a single concurrent scrape with longer ETF and gold timeouts.
- Deterministic scraper regression coverage lives in `tests/e2e/specs/scrapers.spec.js` and uses checked-in HTML fixtures under `tests/e2e/fixtures/scrapers/`.

## Notes
- `refresh=false` serves fresh cache entries until their TTL expires. Expired-but-recent entries can still be reused as stale recovery values when a live scrape fails.
- KID-derived ISIN risk values are now written through to `data/isinRiskCache.json` or `PFB_DATA_DIR/isinRiskCache.json`, so the server can reuse them after a restart instead of rediscovering the same PRIIPs class immediately.
- The portfolio `failures` list only includes assets that ended a scrape pass without any usable value. Stale recovery avoids a hard failure but still represents degraded freshness.
- Reusing pages inside each worker avoids repeated `browser.newPage()` and interception setup on every provider attempt, and lazy page creation means fully fetch-only passes can skip page startup entirely.
- justETF ETF quotes now come from `https://www.justetf.com/api/etfs/:isin/quote`, which avoids the rendered quote shell that can appear incomplete or anti-bot-filtered in headless Chromium. The same vendor adapter first prefers justETF-linked PRIIPs/KID PDFs, then falls back to issuer-hosted PRIIP KIDs for products whose justETF profile only links out to the issuer, including a direct WisdomTree dataspan KID URL for `GB00BJYDH287` because the public issuer page currently returns Cloudflare 403 to server-side fetches, and now recognizes both the original English PRIIPs wording and localized issuer wording such as “Abbiamo classificato questo prodotto al livello N su 7”.
- Yahoo Finance crypto quotes now come from `https://query1.finance.yahoo.com/v8/finance/chart/:symbol-EUR` before any browser navigation is attempted, which removes the heaviest path for the common BTC and ETH refresh case while retaining browser-backed fallbacks.
- The existing `PFB_TEST_MODE=1` fixture runtime still drives dashboard e2e flows. The dedicated scraper spec covers parser and fallback logic without depending on third-party sites.
- On constrained Linux servers, the main failure mode for non-crypto scraping is usually timeout pressure rather than selector drift. justETF pages are materially heavier than the crypto sources, so reducing concurrency and increasing ETF and gold timeouts is the primary mitigation.
- The deployment service now exports `PFB_SCRAPER_CONCURRENCY`, `PFB_SCRAPER_TIMEOUT_MS`, `PFB_SCRAPER_SELECTOR_TIMEOUT_MS`, `PFB_SCRAPER_ETF_TIMEOUT_MS`, `PFB_SCRAPER_ETF_SELECTOR_TIMEOUT_MS`, `PFB_SCRAPER_GOLD_TIMEOUT_MS`, and `PFB_SCRAPER_GOLD_SELECTOR_TIMEOUT_MS` for a 2 GB server profile.

## Related
- [Backend entry point](../server/index.md)
- [Scraper structure](../server/scrapers/index.md)
- [Portfolio orchestration](../server/scripts/portfolio/index.md)
