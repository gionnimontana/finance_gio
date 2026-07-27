# Shared Risk Caches

This page records the shared on-disk cache model for asset risk indicators that should survive server restarts and be reused across users on the same backend.

## Current State
- The backend data root stores `isinRiskCache.json`, `cryptoRiskCache.json`, and `goldRiskCache.json` next to the `users/` folder, either under `data/` or `PFB_DATA_DIR`.
- `server/index.js` loads all three files on startup and hydrates the shared scraper runtime before the HTTP server starts listening.
- `server/api/sharedRiskCache.js` owns the common file behavior: create a missing file, normalize persisted entries, hydrate runtime cache entries, and atomically rewrite sorted JSON through a temporary file plus rename.
- `server/api/isinRiskCache.js`, `cryptoRiskCache.js`, and `goldRiskCache.js` provide the family-specific key normalization and runtime cache-key mapping.
- The generic `/assets/risk-indicators` route persists newly discovered ISIN, crypto, and gold entries after each lookup, while the legacy `/assets/isin-risk` route remains compatible by reading the ISIN slice from the same runtime.

## Notes
- Shared risk-cache files stay outside `users/`, so account deletion removes a user's schema and history without deleting indicator values that may still be useful to other accounts on the same backend.
- Persisted entries are keyed by normalized asset identifier and store `value`, `updatedAt`, `provider`, and optional `sourceUrl` metadata for small, inspectable troubleshooting records.
- `refresh=true` bypasses fresh in-memory cache entries, but persisted values still seed the same runtime map during startup and remain available for stale recovery when allowed by the scraper runtime.
- Runtime write failures are best-effort: the server logs persistence problems and keeps serving successful in-memory risk results instead of failing the API response only because disk persistence failed.
- The current single-process server relies on atomic rewrites rather than explicit file locking. Revisit SQLite or locks only if multiple backend processes later share one data directory.
- Server tests cover file creation, startup hydration, key normalization, write-through persistence, sorted output, and best-effort behavior when cache writes fail.

## Related
- [Data model](./data-model.md)
- [Scraper runtime](./scraper-runtime.md)
- [API helpers](../server/api/index.md)
- [Risk indicator orchestration](../server/scripts/index.md)
