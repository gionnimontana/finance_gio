# ISIN Risk Cache Plan

This page records the implemented shared cache shape for persisting ISIN risk indicators so static KID-derived values do not need to be rediscovered after every process restart.

## Current State
- User data lives under `data/users/` or `PFB_DATA_DIR/users/`, with one folder per password hash and JSON files for `assetsSchema.json` and `historicalData.json`.
- The backend data root now also stores `data/isinRiskCache.json` or `PFB_DATA_DIR/isinRiskCache.json`, outside any user folder, so SRI values are shared across all accounts on the same backend.
- `server/index.js` loads that file once on startup and hydrates the shared scraper runtime before the HTTP server starts listening.
- The `/assets/isin-risk` route still reuses the shared scraper runtime and the existing justETF KID flow, but now writes newly discovered or refreshed runtime entries back to disk with an atomic temp-file rewrite.

## Notes
- The cache stays outside `users/` so values are shared across accounts on the same backend and are not removed by account deletion.
- The dedicated helper lives in `server/api/isinRiskCache.js`, which reuses the backend data-root convention already implied by `PFB_DATA_DIR`.
- File shape: one object keyed by normalized uppercase ISIN, with `value`, `updatedAt`, `provider`, and optional `sourceUrl` metadata for troubleshooting while staying small enough to inspect manually.
- Runtime flow: the shared cache file is created if missing, loaded on startup, copied into the in-memory scraper cache, and only rewritten when the runtime has a changed value for one of the requested ISINs.
- `refresh=true` still bypasses fresh cache entries because the persisted values are hydrated into the same shared runtime map used by the existing scraper logic.
- No new dependency is required. Built-in `fs`, atomic temp-file writes plus rename, and the existing Node 24 runtime are enough for the current single-process server.
- Revisit SQLite or explicit file locking only if the app later runs multiple backend processes against the same shared data directory.
- Server tests now cover startup file creation, runtime hydration from disk, and write-through persistence into the shared JSON file under a temporary `PFB_DATA_DIR`.

## Related
- [Backend entry point](../server/index.md)
- [Data model](./data-model.md)
- [Scraper runtime](./scraper-runtime.md)
