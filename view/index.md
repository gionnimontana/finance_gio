# View

This folder contains the frontend pages, shared browser utilities, and page-specific styling used by the application. Production deploys rewrite local CSS and JS URLs in a generated copy so browsers fetch the new frontend bundle immediately after a release, while leaving these markdown navigation docs in the source tree only.

## Folders

- [assets/index.md](./assets/index.md): Settings UI for assets, `Other`-asset risk overrides, view groups, display preferences, password export, and destructive server-record removal with inline data download.
- [commons/index.md](./commons/index.md): Shared frontend styles and browser utilities, including centralized currency-aware absolute-value formatting, the shared asset-risk fetch helper used by dashboard badges, the shared ATH mood helper used by page titles, and the full-screen auth/loading overlay used during cold page boots.
- [dashboard/index.md](./dashboard/index.md): Main portfolio overview page with refresh progress, grouped completion-state refresh summaries by view group, pie chart rendering, shared currency-prefixed whole-number full-value labels that can switch to compact formatting from Settings while keeping dashboard subrows bare, inline mixed asset-risk badges on dashboard asset rows for ISIN, crypto, gold, and default-or-overridden `Other` assets, weighted size-based risk summaries on group main rows plus an overall portfolio risk summary in the overview card, same-schema failed-refresh preservation for cached asset rows even when the backend silently drops them, a last-full-refresh diff baseline that survives partial refreshes, and a shared loading handoff that covers uncached starts until the first dashboard render is ready.
- [history/index.md](./history/index.md): Historical portfolio summary page with stacked chart, a runtime ATH mood icon in the page title, a scrollable monthly table that keeps its header visible, opens on the newest month, reserves currency prefixes for summary and total values, and now dismisses the shared loading overlay only after the first history render completes.
- [login/index.md](./login/index.md): Login and account-generation page, including the shared loading overlay used while cached-auth validation decides whether the shell should stay on login or redirect onward, with a page-specific shell width that keeps the footer aligned with the login card.

## Related Docs

- [../docs/data-model.md](../docs/data-model.md): Persisted schema/history files, view-group ordering, and browser-local cache behavior shared across pages.
- [../docs/portfolio-metrics.md](../docs/portfolio-metrics.md): Dashboard ATH rules and the summary baselines reused across dashboard and history.
- [../docs/frontend-cache.md](../docs/frontend-cache.md): Production-only generated frontend release behavior and cache-control expectations.
