# Scraper Runtime

This page captures the cross-cutting scraper behavior that matters beyond a single code diff.

## Current State
- The shared runtime in `server/scrapers/core/index.js` normalizes each asset into an ordered provider chain instead of a single scraper target, providers can now resolve values either through browser automation or direct HTTP fetches, and the same in-memory cache can now be preloaded from the shared `data/isinRiskCache.json`, `data/cryptoRiskCache.json`, and `data/goldRiskCache.json` files on server startup.
- Live refreshes reuse one Puppeteer browser per pass, create worker-local pages lazily only when a provider actually needs browser automation, apply a stable browser-like profile before navigation when needed, scrape with bounded concurrency, retry provider-local failures with backoff, and can reuse stale cached values when every live provider fails.
- Crypto quotes now prefer Yahoo Finance's chart API first, then fall back to the Yahoo quote page, Young Platform, and XE. The same Yahoo Finance adapter also exposes reusable daily-history fetch helpers consumed by a crypto risk scorer and a physical-gold risk scorer that map annualized volatility plus max drawdown into deterministic 1-7 `Risk` badges. ETF, gold, validator, and wallet scrapers use the same provider contract even where only one upstream exists today, and ISIN-based synthetic risk indicators now reuse that runtime with justETF profile discovery plus fundinfo KID PDF parsing.
- Low-memory hosts automatically fall back to safer scraper defaults, and the deployment script pins the production service to a single concurrent scrape with longer ETF and gold timeouts.
- Deterministic scraper regression coverage lives in `tests/e2e/specs/scrapers.spec.js` and uses checked-in HTML fixtures under `tests/e2e/fixtures/scrapers/`.

## Notes
- `refresh=false` serves fresh cache entries until their TTL expires. Expired-but-recent entries can still be reused as stale recovery values when a live scrape fails.
- KID-derived ISIN risk values are now written through to `data/isinRiskCache.json` or `PFB_DATA_DIR/isinRiskCache.json`, computed crypto risk scores are written through to `data/cryptoRiskCache.json` or `PFB_DATA_DIR/cryptoRiskCache.json`, and computed gold risk scores are written through to `data/goldRiskCache.json` or `PFB_DATA_DIR/goldRiskCache.json`, so the server can reuse all indicator families after a restart.
- Shared risk-cache persistence is best-effort: runtime write failures (for example, temporary read-only deploy filesystems or permission drift) are logged but do not fail the risk-indicator response, so cached in-memory fallback values can still be served.
- Crypto and gold risk scoring fetch a `1y` range of Yahoo Finance daily closes, score annualized realized volatility over the last 90 closes, score max drawdown over the last 365 closes (effectively the whole fetched year), and keep the higher bucket on a fixed 1-7 scale so the result stays deterministic and fetch-first. Lookbacks count closes, not calendar days: 90 crypto closes span ~90 days, while 90 gold-futures closes span ~4 months of trading days.
- Volatility is annualized with $\sqrt{365}$ for both families. That matches 24/7 crypto trading, but gold futures trade ~252 days a year, so gold volatility reads about 20% higher than a trading-day annualization would give.
- Gold history currently comes from Yahoo Finance gold futures (`GC=F`, USD-denominated) while the live EUR-per-gram quote still comes from goldpreis.de, so the gold `Risk` score ignores EUR/USD movement.
- The computed crypto/gold `Risk` scale is project-specific and is not the regulatory PRIIPs `SRI` used for ISIN assets, even though both render on 1-7.
- Both computed scorers bucket each metric with inclusive thresholds for scores 1-6 (anything above scores 7). Annualized volatility thresholds are `0.20, 0.35, 0.50, 0.65, 0.85, 1.05`; max-drawdown thresholds are `0.10, 0.20, 0.30, 0.45, 0.60, 0.75`.
- Default cache windows are 5 minutes fresh and 12 hours stale (`PFB_SCRAPER_CACHE_TTL_MS`, `PFB_SCRAPER_STALE_CACHE_TTL_MS`). ISIN, crypto, and gold risk entries override only the fresh TTL to 24 hours and inherit the 12-hour stale window, so a risk entry older than 12 hours is never reused as stale recovery.
- Low-memory detection compares `os.totalmem()` with `PFB_SCRAPER_LOW_MEMORY_THRESHOLD_BYTES` (default 3 GB).
- The portfolio `failures` list includes assets that ended a scrape pass without any usable value, and the shared runtime now also marks every unresolved asset as failed if an unexpected top-level abort interrupts the refresh before all pending scrapes finish. Stale recovery avoids a hard failure but still represents degraded freshness.
- Reusing pages inside each worker avoids repeated `browser.newPage()` and interception setup on every provider attempt, and lazy page creation means fully fetch-only passes can skip page startup entirely.
- justETF ETF quotes now come from `https://www.justetf.com/api/etfs/:isin/quote`, which avoids the rendered quote shell that can appear incomplete or anti-bot-filtered in headless Chromium. The same vendor adapter first prefers justETF-linked PRIIPs/KID PDFs, then falls back to issuer-hosted PRIIP KIDs for products whose justETF profile only links out to the issuer, including a direct WisdomTree dataspan KID URL for `GB00BJYDH287` when justETF points at either the `wisdomtree.eu` or `wisdomtree.com` issuer site because those product pages can redirect or block server-side fetches, and now recognizes both the original English PRIIPs wording and localized issuer wording such as “Abbiamo classificato questo prodotto al livello N su 7”.
- Yahoo Finance crypto quotes now come from `https://query1.finance.yahoo.com/v8/finance/chart/:symbol-EUR` before any browser navigation is attempted, which removes the heaviest path for the common BTC and ETH refresh case while retaining browser-backed fallbacks.
- The existing `PFB_TEST_MODE=1` fixture runtime still drives dashboard e2e flows. The dedicated scraper spec covers parser and fallback logic without depending on third-party sites.
- Risk scorers, KID parsing, risk caches, and the unexpected-abort path are also covered by `node:test` files under `tests/server/`. Run them with `npm run test:server`; they also run in `npm test`, the pre-commit hook, and CI.
- On constrained Linux servers, the main failure mode for non-crypto scraping is usually timeout pressure rather than selector drift. justETF pages are materially heavier than the crypto sources, so reducing concurrency and increasing ETF and gold timeouts is the primary mitigation.
- The deployment service now exports `PFB_SCRAPER_CONCURRENCY`, `PFB_SCRAPER_TIMEOUT_MS`, `PFB_SCRAPER_SELECTOR_TIMEOUT_MS`, `PFB_SCRAPER_ETF_TIMEOUT_MS`, `PFB_SCRAPER_ETF_SELECTOR_TIMEOUT_MS`, `PFB_SCRAPER_GOLD_TIMEOUT_MS`, and `PFB_SCRAPER_GOLD_SELECTOR_TIMEOUT_MS` for a 2 GB server profile.

## Related
- [Backend entry point](../server/index.md)
- [Scraper structure](../server/scrapers/index.md)
- [Portfolio orchestration](../server/scripts/portfolio/index.md)
- [Shared risk caches](./shared-risk-caches.md)
- [Deploy runtime and systemd env](./deploy-runtime.md)
- [Risk indicators](./risk-indicators.md): badge families and how computed scores differ from PRIIPs SRI
- [Configuration](./configuration.md): every `PFB_SCRAPER_*` variable and default
- [Testing](./testing.md)
