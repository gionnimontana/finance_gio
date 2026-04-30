# Portfolio Script

This folder contains the backend logic that converts asset schemas and live market values into grouped portfolio responses.

## Files

- [index.js](./index.js): Aggregates asset values, groups totals by view group, derives all-time-high metadata from saved history plus the current live total, attaches the current schema cache key, and emits SSE progress and completion payloads for both manual refreshes and first-load streams.