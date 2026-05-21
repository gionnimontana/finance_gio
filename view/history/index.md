# History

This folder contains the authenticated historical portfolio page and its chart/table rendering logic, using shared currency-prefixed absolute-value formatting for summaries and total cells while keeping compact chart labels and non-total history-table values bare, plus a sticky, opaque table header inside the scroll area that opens on the newest month.

## Files

- [chart.js](./chart.js): Canvas-based stacked history chart and monthly breakdown table rendering, with always-compact bare canvas labels, currency-prefixed total cells, and bare non-total table values.
- [index.html](./index.html): History page markup for summary cards, chart output, detailed monthly data, and the runtime-updated page title, with display preferences now managed from Settings.
- [script.js](./script.js): History data loading, title mood updates based on the latest historical ATH, summary-card updates, visibility-change re-rendering, and auto-scrolling the monthly table to the newest month after each render.
- [styles.css](./styles.css): Page-specific styling for the history chart area and the scrollable breakdown table with a sticky, readable header row.

## Related Docs

- [../../docs/portfolio-metrics.md](../../docs/portfolio-metrics.md): History title-mood behavior and how it differs from the live dashboard ATH summary.
- [../../docs/data-model.md](../../docs/data-model.md): Historical snapshot shape, view-group ordering, and schema-backed rendering behavior.