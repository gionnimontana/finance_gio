# API

This folder persists and normalizes per-user asset schema data and monthly historical portfolio snapshots.

## Files

- [index.js](./index.js): Reads, validates, migrates, and writes `assetsSchema.json` and `historicalData.json` for a user, including per-user `riskOverrides` values used only by `Other` assets and `viewGroupColors` maps that follow simple group renames, derives a schema cache key used by the dashboard to invalidate stale local portfolio snapshots, and skips current-month history overwrites when a live refresh still reports scraper failures.
- [cryptoRiskCache.js](./cryptoRiskCache.js): Loads and atomically rewrites the shared `cryptoRiskCache.json` file stored under the backend data root so computed crypto risk scores survive server restarts and remain shared across all users.
- [goldRiskCache.js](./goldRiskCache.js): Loads and atomically rewrites the shared `goldRiskCache.json` file stored under the backend data root so computed physical-gold risk scores survive server restarts and remain shared across all users.
- [isinRiskCache.js](./isinRiskCache.js): Loads and atomically rewrites the shared `isinRiskCache.json` file stored under the backend data root so KID-derived ISIN risk values survive server restarts and remain shared across all users.
- [sharedRiskCache.js](./sharedRiskCache.js): Provides the shared on-disk cache helper reused by ISIN, crypto, and gold risk-indicator persistence modules, including best-effort persistence when disk writes fail at runtime.
