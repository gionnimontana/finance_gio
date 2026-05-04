# View

This folder contains the frontend pages, shared browser utilities, and page-specific styling used by the application. Production deploys rewrite local CSS and JS URLs in a generated copy so browsers fetch the new frontend bundle immediately after a release, while leaving these markdown navigation docs in the source tree only.

## Folders

- [assets/index.md](./assets/index.md): Settings UI for assets, view groups, display preferences, and password export.
- [commons/index.md](./commons/index.md): Shared frontend styles and browser utilities, including centralized currency-aware absolute-value formatting.
- [dashboard/index.md](./dashboard/index.md): Main portfolio overview page with refresh progress, pie chart rendering, and shared currency-prefixed whole-number full-value labels that can switch to compact formatting from Settings while keeping dashboard subrows bare.
- [history/index.md](./history/index.md): Historical portfolio summary page with stacked chart and a scrollable monthly table that keeps its header visible while reserving currency prefixes for summary and total values.
- [login/index.md](./login/index.md): Login and account-generation page.