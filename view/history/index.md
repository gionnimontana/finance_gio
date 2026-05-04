# History

This folder contains the authenticated historical portfolio page and its chart/table rendering logic, using shared absolute-value formatting for summaries and the monthly breakdown while always keeping the canvas chart labels compact for readability, plus a sticky, opaque table header inside the scroll area.

## Files

- [chart.js](./chart.js): Canvas-based stacked history chart and monthly breakdown table rendering, with always-compact canvas labels and shared summary/table absolute-value formatting.
- [index.html](./index.html): History page markup for summary cards, chart output, and detailed monthly data.
- [script.js](./script.js): History data loading, summary-card updates, and visibility-change re-rendering.
- [styles.css](./styles.css): Page-specific styling for the history chart area and the scrollable breakdown table with a sticky, readable header row.