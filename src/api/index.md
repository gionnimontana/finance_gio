# API

This folder persists and normalizes per-user asset schema data and monthly historical portfolio snapshots.

## Files

- [index.js](./index.js): Reads, validates, migrates, and writes `assetsSchema.json` and `historicalData.json` for a user, and derives a schema cache key used by the dashboard to invalidate stale local portfolio snapshots.