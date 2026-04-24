# Dashboard

This folder contains the main authenticated portfolio overview page and its page-specific rendering logic.

## Files

- [chart.js](./chart.js): Canvas-based pie chart rendering for portfolio totals by view group with a DOM-backed legend.
- [index.html](./index.html): Dashboard markup for overview cards, progress banner, chart canvas, and legend host.
- [script.js](./script.js): Portfolio fetching, refresh streaming, cache reconciliation, and DOM rendering logic, including chart-color-tinted group cards.
- [styles.css](./styles.css): Page-specific styling for overview cards, grouped rows, chart-matched card tinting, the chart legend layout, and the refresh progress banner.