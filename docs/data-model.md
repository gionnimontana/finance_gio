# Data Model

This page summarizes how user identity, persisted portfolio data, and browser-local cache state interact across pages and devices.

## Current State
- A user is identified only by the password they enter on the login page. The backend hashes that password with SHA-256 and uses the hash as the user folder name under `data/users/` or `PFB_DATA_DIR/users/`.
- Each user folder stores two JSON files: `assetsSchema.json` for editable assets and view groups, and `historicalData.json` for monthly portfolio snapshots grouped by view group.
- `assetsSchema.json` currently persists `assets`, `viewGroups`, `prevMonthTotal`, and `initYearNetworth`.
- `historicalData.json` stores monthly entries with `date`, `label`, `total`, and one total bucket per view group.
- The settings page always reads the latest schema from `/assets/schema` and writes updates back through `/assets/schema` and `/assets/view-groups`.
- The dashboard keeps a browser-local `portfolio` snapshot in `localStorage` for fast reloads. The cached snapshot now carries a schema cache key and is refetched when the backend reports a different asset-schema shape.

## Notes
- Multiple devices only share changes when they are connected to the same running backend and therefore the same user-data directory. Two separate local `http://localhost:8085` instances do not share `data/users/` state.
- Login state is browser-local. The frontend stores the raw password in `localStorage` as `userPassword` and sends it on each authenticated request through the `X-User-Password` header.
- The dashboard cache key is derived from the persisted asset rows plus the view-group ordering. Changes such as adding, removing, renaming, regrouping, or resizing assets invalidate an older dashboard snapshot on the next load.
- Open pages are not real-time synchronized. Another session sees changes when it reloads the page, navigates back through a page that refetches, or manually refreshes the dashboard.

## Related
- [../src/auth/index.md](../src/auth/index.md)
- [../src/api/index.md](../src/api/index.md)
- [../view/assets/index.md](../view/assets/index.md)
- [../view/dashboard/index.md](../view/dashboard/index.md)