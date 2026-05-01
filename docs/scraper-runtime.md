# Scraper Runtime

This page captures the cross-cutting scraper behavior that matters beyond a single code diff.

## Current State
- The shared runtime in `server/scrapers/core/index.js` normalizes each asset into an ordered provider chain instead of a single scraper target.
- Live refreshes reuse one Puppeteer browser per pass plus one Puppeteer page per worker, scrape with bounded concurrency, retry provider-local failures with backoff, and can reuse stale cached values when every live provider fails.
- Crypto quotes currently prefer Yahoo Finance first, then Young Platform, then XE. ETF, gold, validator, and wallet scrapers use the same provider contract even where only one upstream exists today.
- Low-memory hosts automatically fall back to safer scraper defaults, and the deployment script pins the production service to a single concurrent scrape with longer ETF and gold timeouts.
- Deterministic scraper regression coverage lives in `tests/e2e/specs/scrapers.spec.js` and uses checked-in HTML fixtures under `tests/e2e/fixtures/scrapers/`.

## Notes
- `refresh=false` serves fresh cache entries until their TTL expires. Expired-but-recent entries can still be reused as stale recovery values when a live scrape fails.
- The portfolio `failures` list only includes assets that ended a scrape pass without any usable value. Stale recovery avoids a hard failure but still represents degraded freshness.
- Reusing pages inside each worker avoids repeated `browser.newPage()` and interception setup on every provider attempt, which trims overhead on small Linux VPS hosts without increasing the live scrape concurrency default.
- The existing `PFB_TEST_MODE=1` fixture runtime still drives dashboard e2e flows. The dedicated scraper spec covers parser and fallback logic without depending on third-party sites.
- On constrained Linux servers, the main failure mode for non-crypto scraping is usually timeout pressure rather than selector drift. justETF pages are materially heavier than the crypto sources, so reducing concurrency and increasing ETF and gold timeouts is the primary mitigation.
- The deployment service now exports `PFB_SCRAPER_CONCURRENCY`, `PFB_SCRAPER_TIMEOUT_MS`, `PFB_SCRAPER_SELECTOR_TIMEOUT_MS`, `PFB_SCRAPER_ETF_TIMEOUT_MS`, `PFB_SCRAPER_ETF_SELECTOR_TIMEOUT_MS`, `PFB_SCRAPER_GOLD_TIMEOUT_MS`, and `PFB_SCRAPER_GOLD_SELECTOR_TIMEOUT_MS` for a 2 GB server profile.

## Related
- [Backend entry point](../server/index.md)
- [Scraper structure](../server/scrapers/index.md)
- [Portfolio orchestration](../server/scripts/portfolio/index.md)