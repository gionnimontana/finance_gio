# Data Model

This page summarizes how user identity, persisted portfolio data, and browser-local cache state interact across pages and devices.

## Current State
- A user is identified only by the password they enter on the login page. The backend hashes that password with SHA-256 and uses the hash as the user folder name under `data/users/` or `PFB_DATA_DIR/users/`.
- Each user folder stores two JSON files: `assetsSchema.json` for editable assets and view groups, and `historicalData.json` for monthly portfolio snapshots grouped by view group.
- The backend data root also stores shared `isinRiskCache.json`, `cryptoRiskCache.json`, and `goldRiskCache.json` files outside `users/`, so KID-derived ISIN risk values plus computed crypto and gold risk scores are reused across all accounts on the same server.
- The settings page can delete the current user by removing that hashed user folder entirely, so account removal wipes both persisted JSON files in one server-side operation.
- `assetsSchema.json` currently persists `assets`, `viewGroups`, `riskOverrides`, `prevMonthTotal`, and `initYearNetworth`, so asset definitions, display grouping, `Other`-asset manual risk overrides, and summary baselines live together.
- `viewGroups` is the canonical ordering shared by Settings, Dashboard, and History when those pages render group rows, cards, charts, and tables.
- `historicalData.json` stores monthly entries with `date`, `label`, `total`, and one total bucket per view group.
- The settings page always reads the latest schema from `/assets/schema`, writes asset updates back through `/assets/schema`, and writes explicit group-order changes through `/assets/view-groups`.
- The dashboard keeps a browser-local `portfolio` snapshot in `localStorage` for fast reloads. Before reusing it, the frontend compares the cached `schemaCacheKey` against the backend schema and refreshes when the asset or group shape changed.

## Notes
- Saving assets keeps the existing `viewGroups` list but automatically appends any newly referenced group so ad-hoc regrouping stays valid.
- Saving `viewGroups` can treat one removed group plus one added group as a rename. In that case the backend migrates both asset rows and historical monthly group buckets to the new label before persisting the schema.
- The dashboard cache key is derived from the persisted asset rows plus the explicit view-group ordering. Changes such as adding, removing, renaming, regrouping, or resizing assets invalidate an older dashboard snapshot on the next load.
- The dashboard also merges the latest schema view-group order into cached portfolio data before rendering, while the history page fetches the schema for the same stable ordering and falls back to inferred group keys only when schema loading fails.
- `prevMonthTotal` and `initYearNetworth` stay in `assetsSchema.json` because the backend live-refresh flow derives those summary baselines from saved history before returning current portfolio data.
- The shared `isinRiskCache.json`, `cryptoRiskCache.json`, and `goldRiskCache.json` files are not tied to one user, so deleting an account does not remove previously discovered risk indicators for other accounts on the same backend.
- The dashboard fetches generic asset risk indicators from `/assets/risk-indicators`, which currently returns regulatory `SRI` labels for ISIN assets, computed `Risk` labels for crypto and gold assets, and `Risk` labels for `Other` assets with a default `1/7` that can be overridden per user via `assetsSchema.riskOverrides`.
- Multiple devices only share changes when they are connected to the same running backend and therefore the same backend data directory. Two separate local `http://localhost:8085` instances do not share `data/users/` state or the shared risk-cache files.
- Login state is browser-local. The frontend stores the raw password in `localStorage` as `userPassword` and sends it on each authenticated request through the `X-User-Password` header.
- Account deletion clears the browser-local password as part of the logout redirect after the server folder has been removed, so the deleted password immediately stops authenticating on the same device.
- Open pages are not real-time synchronized. Another session sees changes when it reloads the page, navigates back through a page that refetches, or manually refreshes the dashboard.

## Related
- [../server/auth/index.md](../server/auth/index.md)
- [../server/api/index.md](../server/api/index.md)
- [../view/assets/index.md](../view/assets/index.md)
- [../view/dashboard/index.md](../view/dashboard/index.md)
- [../view/history/index.md](../view/history/index.md)
- [./portfolio-metrics.md](./portfolio-metrics.md)
