# Dashboard

This folder contains the main authenticated portfolio overview page and its page-specific rendering logic.

## Files

- [chart.js](./chart.js): Canvas-based pie chart rendering for portfolio totals by view group with a DOM-backed legend.
- [index.html](./index.html): Dashboard markup for overview cards, including the ATH distance line, the runtime-updated page title, the progress banner, chart canvas, and legend host.
- [script.js](./script.js): Portfolio fetching, first-load asset-level streaming feedback, refresh streaming, schema-aware cache reconciliation, and DOM rendering logic, including precise crypto subrow rendering, shared compact absolute-value formatting, the ATH mood indicator, the runtime dashboard title mood icon, and chart-color-tinted group cards.
- [styles.css](./styles.css): Page-specific styling for overview cards, including the compact mobile inline summary layout, the ATH summary line, grouped rows, chart-matched card tinting, the chart legend layout, and the refresh progress banner, including its fallback indeterminate loading state.