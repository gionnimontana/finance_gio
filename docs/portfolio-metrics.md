# Portfolio Metrics

This page explains the cross-cutting summary values shared across the dashboard and history views, especially the saved all-time-high baseline.

## Current State
- The backend portfolio builder returns `total`, `allTimeHighTotal`, and `allTimeHighLabel` in dashboard portfolio payloads.
- The dashboard `Distance from ATH` summary compares the current portfolio total against the highest saved historical entry before the current month. Current-month history rows are ignored so an in-progress month does not redefine the saved benchmark.
- When the current total matches the saved ATH within the frontend rounding threshold (`±0.005`), the dashboard shows `At ...` instead of a delta. Values above the saved historical ATH still render as positive and update the title mood as a new high versus saved history.
- The history page title mood is separate from the live dashboard summary. It compares the latest loaded history row against the highest total inside the loaded history dataset, so it reflects the monthly history view rather than the live portfolio fetch.
- The history `Avg Monthly Growth` summary card is a compounded monthly rate over the loaded history: $\left(\frac{\text{latest total}}{\text{first total}}\right)^{1/\text{months}} - 1$. It renders `—` when the first or latest total is not positive or when fewer than two monthly rows exist.
- The history `Avg Annual Growth` summary card annualizes the same compounded rate: $\left(\frac{\text{latest total}}{\text{first total}}\right)^{12/\text{months}} - 1$, sharing the same baseline fallback.
- `prevMonthTotal` and `initYearNetworth` are persisted in `assetsSchema.json` and refreshed from saved history during live refreshes before the backend returns portfolio summaries.
- The optional `shortHorizon` payload object (`currentTotal`, `previousTotal`, `horizon`, and optional unrounded `percentage`) drives only the dashboard's short-horizon overview row. It is not reused for the refresh banner or title mood.
- The dashboard title mood and `progress_delta` percentage compare the latest total against the last fully successful browser refresh total: $\frac{\text{latest total} - \text{previous total}}{\text{previous total}} \times 100$. A clean completion persists its source totals in `portfolioLastRefreshDelta`, keyed to the displayed current total, so the title keeps the latest-refresh mood after reload. A partial refresh can display its in-memory delta but does not replace the saved clean-refresh summary.
- Portfolio weather bands are `<= -10`, `<= -5`, `<= -2`, `<= -1`, `< -0.25`, `<= 0.25`, `< 1`, `< 4`, `< 10`, and otherwise, mapping to `☠️`, `💥`, `🌪️`, `⛈️`, `🌧️`, `🌤️`, `☀️`, `🌞`, `🌈`, and `🦄`. Completed group deltas use the same numeric boundaries through the separate `getProgressGroupDeltaMood()` contract and omit a mood when their prior total is absent or zero.

## Notes
- Older cached dashboard payloads that lack `allTimeHighTotal` or `allTimeHighLabel` trigger a refresh instead of silently rendering incomplete ATH UI.
- The backend regression in `tests/server/portfolio-ath.test.js` guards the rule that saved history before the current month drives the dashboard ATH baseline.
- Dashboard and history both use the shared frontend `getAthMood()` helper for the title icon, but they feed it different baselines as described above.

## Related
- [../server/scripts/portfolio/index.md](../server/scripts/portfolio/index.md)
- [../view/dashboard/index.md](../view/dashboard/index.md)
- [../view/history/index.md](../view/history/index.md)
- [./data-model.md](./data-model.md)