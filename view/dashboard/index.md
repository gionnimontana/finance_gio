# Dashboard

This folder contains the main authenticated portfolio overview page and its page-specific rendering logic.

## Files

- [chart.js](./chart.js): Canvas-based pie chart rendering for portfolio totals by view group with a DOM-backed legend.
- [index.html](./index.html): Dashboard markup for overview cards, including the ATH distance line, the runtime-updated page title, the progress banner, chart canvas, and legend host, with display preferences now managed from Settings.
- [script.js](./script.js): Portfolio fetching, first-load asset-level streaming feedback, refresh streaming, schema-aware cache reconciliation, and DOM rendering logic, including shared currency-prefixed absolute-value formatting that renders whole-number full values and can switch to compact `k` and `m` labels from Settings while keeping dashboard subrow values bare, the ATH distance summary with positive or negative styling against the saved historical ATH, the runtime dashboard title mood icon, chart-color-tinted group cards, and a completion-state progress banner that regroups refreshed assets under view-group headers with grouped diffs before persisting the finished banner.
- [styles.css](./styles.css): Page-specific styling for overview cards, including the compact mobile inline summary layout, the ATH summary line, grouped rows, chart-matched card tinting, the chart legend layout, and the refresh progress banner, including its fallback indeterminate loading state and grouped completion-state sections.