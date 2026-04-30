# Docs Log

This file is an append-only history of notable wiki updates.

Use one heading per entry:

```md
## [YYYY-MM-DD] update | Short title
- What changed.
- Why it mattered.
```

Supported labels are `bootstrap`, `update`, `query`, and `lint`.

## [2026-04-24] bootstrap | Create docs wiki
- Added the initial `docs/` wiki shell with `index.md`, `schema.md`, and `log.md`.
- Defined `docs/` as the home for cross-cutting project knowledge rather than code-structure inventory.

## [2026-04-30] update | Document data model and cache invalidation
- Added a `docs/data-model.md` topic page that explains password-derived user storage, persisted JSON files, browser-local cache usage, and the requirement for a shared backend when using multiple devices.
- Recorded the dashboard schema-cache invalidation behavior so cross-session asset edits are easier to reason about and troubleshoot.
