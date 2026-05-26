# Dashboard

This folder contains the main authenticated portfolio overview page and its page-specific rendering logic.

## Files

- [chart.js](./chart.js): Canvas-based pie chart rendering for portfolio totals by view group with a DOM-backed legend.
- [index.html](./index.html): Dashboard markup for overview cards, including the ATH distance line, a portfolio-level weighted risk summary line, the runtime-updated page title, the progress banner, chart canvas, legend host, and the shared loading overlay that masks cold boots before the page is ready, with display preferences now managed from Settings.
- [script.js](./script.js): Portfolio fetching, first-load asset-level streaming feedback, refresh streaming, schema-aware cache reconciliation, and DOM rendering logic, including shared currency-prefixed absolute-value formatting that renders whole-number full values and can switch to compact `k` and `m` labels from Settings while keeping dashboard subrow values bare, background-loaded mixed asset-risk badges rendered between each supported asset name and value with `SRI` for ISINs and `Risk` for crypto and gold, weighted size-based `Risk x/7` summaries for each dashboard group main row and the overall portfolio overview, the ATH distance summary with positive or negative styling against the saved historical ATH, the runtime dashboard title mood icon, chart-color-tinted group cards, a completion-state progress banner that regroups refreshed assets under view-group headers with grouped diffs before persisting the finished banner, and delayed loading-overlay dismissal until cached or live portfolio data has rendered.
- [styles.css](./styles.css): Page-specific styling for overview cards, including the compact mobile inline summary layout, the ATH summary line, grouped rows, inline asset-risk badges, weighted-risk summary badges for group headers and the overview, chart-matched card tinting, the chart legend layout, and the refresh progress banner, including its fallback indeterminate loading state and grouped completion-state sections.

## Related Docs

- [../../docs/portfolio-metrics.md](../../docs/portfolio-metrics.md): Saved-history ATH rules, title mood behavior, and cached-portfolio refresh expectations.
- [../../docs/data-model.md](../../docs/data-model.md): Schema cache invalidation, view-group ordering, and the persisted summary fields behind dashboard rendering.
