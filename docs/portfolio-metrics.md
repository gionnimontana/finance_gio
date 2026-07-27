# Portfolio Metrics

This page explains the cross-cutting summary values shared across the dashboard and history views, especially the saved all-time-high baseline.

## Current State
- The backend portfolio builder returns `total`, `allTimeHighTotal`, and `allTimeHighLabel` in dashboard portfolio payloads.
- The dashboard `Distance from ATH` summary compares the current portfolio total against the highest saved historical entry before the current month. Current-month history rows are ignored so an in-progress month does not redefine the saved benchmark.
- When the current total matches the saved ATH within the frontend rounding threshold (`±0.005`), the dashboard shows `At ...` instead of a delta. Values above the saved historical ATH still render as positive and update the title mood as a new high versus saved history.
- The history page title mood is separate from the live dashboard summary. It compares the latest loaded history row against the highest total inside the loaded history dataset, so it reflects the monthly history view rather than the live portfolio fetch.
- `prevMonthTotal` and `initYearNetworth` are persisted in `assetsSchema.json` and refreshed from saved history during live refreshes before the backend returns portfolio summaries.

## Notes
- Older cached dashboard payloads that lack `allTimeHighTotal` or `allTimeHighLabel` trigger a refresh instead of silently rendering incomplete ATH UI.
- The backend regression in `tests/server/portfolio-ath.test.js` guards the rule that saved history before the current month drives the dashboard ATH baseline.
- Dashboard and history both use the shared frontend `getAthMood()` helper for the title icon, but they feed it different baselines as described above.

## Related
- [../server/scripts/portfolio/index.md](../server/scripts/portfolio/index.md)
- [../view/dashboard/index.md](../view/dashboard/index.md)
- [../view/history/index.md](../view/history/index.md)
- [./data-model.md](./data-model.md)