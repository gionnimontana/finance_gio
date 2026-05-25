# ISIN Risk Cache Plan

This page records the planned shape for persisting shared ISIN risk indicators so static KID-derived values do not need to be rediscovered after every process restart.

## Current State
- User data lives under `data/users/` or `PFB_DATA_DIR/users/`, with one folder per password hash and JSON files for `assetsSchema.json` and `historicalData.json`.
- The `/assets/isin-risk` route reuses the shared scraper runtime and its process-local cache map, so fresh ISIN risk values can be reused during one server lifetime but are lost on restart.
- The justETF ISIN risk path already uses its own cache key namespace and a 24-hour fresh-cache TTL, but that cache currently lives only in memory.
- The backend already uses plain JSON files plus built-in Node.js filesystem APIs for persisted state, and the dependency surface stays intentionally small.

## Notes
- Recommended storage location: a shared JSON file under the backend data root, outside any user folder, such as `PFB_DATA_DIR/shared/isinRiskCache.json`.
- Keep the cache outside `users/` so values are shared across accounts on the same backend and are not removed by account deletion.
- Prefer a small dedicated storage helper near the existing persistence code, for example `server/api/isinRiskCache.js`, so it can reuse the same data-root conventions without teaching the generic scraper core to persist every asset class.
- Minimal file shape: one object keyed by normalized uppercase ISIN, with `value`, `updatedAt`, `provider`, and optional `sourceUrl` or `kidUrl` metadata for troubleshooting.
- Runtime flow: load the shared cache lazily, serve fresh persisted entries first, scrape only missing or expired ISINs, then update the in-memory copy and atomically rewrite the JSON file.
- `refresh=true` should bypass fresh persisted entries but still allow stale persisted values as a fallback when the live justETF or KID fetch fails.
- A longer persistent TTL makes sense because PRIIPs risk classes are comparatively static. A 30-day default is a reasonable starting point, while keeping an env override available for shorter refresh windows.
- No new dependency is required for the first implementation. Built-in `fs`, atomic temp-file writes plus rename, and the existing Node 24 runtime are enough for a single-process server.
- Revisit SQLite or explicit file locking only if the app later runs multiple backend processes against the same shared data directory.
- Narrow tests should cover persistence across module reload, shared-cache survival after `deleteUser`, selective scraping of only missing ISINs, and temp `PFB_DATA_DIR` isolation in server tests.

## Related
- [Backend entry point](../server/index.md)
- [Data model](./data-model.md)
- [Scraper runtime](./scraper-runtime.md)
