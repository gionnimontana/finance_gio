# Scraper Runtime

This page captures the cross-cutting scraper behavior that matters beyond a single code diff.

## Current State
- The shared runtime in `src/scrapers/core/index.js` normalizes each asset into an ordered provider chain instead of a single scraper target.
- Live refreshes reuse one Puppeteer browser per pass, scrape with bounded concurrency, retry provider-local failures with backoff, and can reuse stale cached values when every live provider fails.
- Crypto quotes currently prefer Yahoo Finance first, then Young Platform, then XE. ETF, gold, validator, and wallet scrapers use the same provider contract even where only one upstream exists today.
- Deterministic scraper regression coverage lives in `tests/e2e/specs/scrapers.spec.js` and uses checked-in HTML fixtures under `tests/e2e/fixtures/scrapers/`.

## Notes
- `refresh=false` serves fresh cache entries until their TTL expires. Expired-but-recent entries can still be reused as stale recovery values when a live scrape fails.
- The portfolio `failures` list only includes assets that ended a scrape pass without any usable value. Stale recovery avoids a hard failure but still represents degraded freshness.
- The existing `PFB_TEST_MODE=1` fixture runtime still drives dashboard e2e flows. The dedicated scraper spec covers parser and fallback logic without depending on third-party sites.

## Related
- [Backend entry point](../src/index.md)
- [Scraper structure](../src/scrapers/index.md)
- [Portfolio orchestration](../src/scripts/portfolio/index.md)