# Portfolio Refresh Flow

How the dashboard loads and refreshes portfolio values, which endpoint each path uses, and when saved history changes.

## Current State
- `GET /portfolio?refresh=<bool>` returns one JSON portfolio payload. `refresh` defaults to `false`; `true` bypasses fresh scraper cache entries.
- `GET /portfolio/stream?refresh=<bool>` returns `text/event-stream` and defaults `refresh` to `true`. Nginx proxies it with `proxy_buffering off` so events arrive as they are sent.
- Stream events:
  - `progress`: one per asset, with `assetName`, `assetId`, `value`, `assetTotal`, `failed`, `index`, `total`, `currentPortfolioTotal`, `prevMonthTotal`, `initYearNetworth`, and `shortHorizon`.
  - `complete`: the final portfolio payload, identical in shape to `GET /portfolio`.
  - `error`: `{ message }` when the server throws after headers are sent.
- The portfolio payload carries `total`, one `{ total, details }` object per view group, `failures` (display names), `prevMonthTotal`, `initYearNetworth`, `allTimeHighTotal`, `allTimeHighLabel`, `shortHorizon`, and `schemaCacheKey`.

## Side Effects Of `refresh=true`
- Before scraping, the backend recomputes `prevMonthTotal` and `initYearNetworth` from saved history and writes them into `assetsSchema.json`.
- After scraping, it upserts the current month into `historicalData.json`, unless the payload has `failures`. See [data-model.md](./data-model.md) for the bucket shape.
- `refresh=false` never writes history.

## Frontend Paths
- Manual refresh button: stream with `refresh=true`, then persist the snapshot and completion banner.
- First load with no cached `portfolio`: stream with `refresh=false` so the banner still shows per-asset progress.
- Cached payload from an older format (missing `allTimeHighTotal`/`allTimeHighLabel` or asset `displayName`), or a `schemaCacheKey` mismatch: plain `GET /portfolio?refresh=false`. A portfolio without some view group (for example no `Gold` assets) is not treated as an older format, so it does not refetch on every landing.
- Stream connection failure, non-OK response, `error` event, or a stream that ends without `complete`: fall back to `GET /portfolio` with the same `refresh` flag. A fallback with `refresh=true` still writes history on the server.
- Risk badges load separately from `/assets/risk-indicators`; see [risk-indicators.md](./risk-indicators.md).

## Notes
- Partial refreshes (any `failures`, or same-schema assets missing from the payload) keep cached rows and the last-successful baselines; the rules live in [data-model.md](./data-model.md) and [portfolio-metrics.md](./portfolio-metrics.md).
- Scraper retries, stale-cache reuse, and failure propagation are covered in [scraper-runtime.md](./scraper-runtime.md).

## Related
- [../server/scripts/portfolio/index.md](../server/scripts/portfolio/index.md)
- [../view/dashboard/index.md](../view/dashboard/index.md)
- [./auth-security.md](./auth-security.md): header auth on the stream
- [./deploy-runtime.md](./deploy-runtime.md): Nginx route allowlist
