# Commons

This folder contains the frontend assets shared across every page in the application.

## Files

- [styles.css](./styles.css): Shared layout, sticky desktop header, mobile bottom navigation, banners, tables, summary-card styling, and the dark full-screen loading overlay used during cold page boots.
- [utils.js](./utils.js): Common auth, fetch, centralized currency-aware whole-number full-value or compact absolute-value formatting with persisted Settings preferences plus opt-in forced-compact labels and no-currency overrides for exception views, privacy-aware percentage helpers, shared saved-or-default view-group color resolution, shared authenticated assets-schema, history, and asset-risk fetch helpers, shared ATH mood-title helpers plus the `getPerformanceWeatherMood()` and `getProgressGroupDeltaMood()` weather helpers, shared footer and banner utilities, and the helper that dismisses the loading overlay only after the first page render is ready.

## Related Docs

- [../../docs/portfolio-metrics.md](../../docs/portfolio-metrics.md): ATH and weather mood band contracts implemented by the shared helpers.
- [../../docs/data-model.md](../../docs/data-model.md): Browser-local password storage, auth headers, and logout behavior.
- [../../docs/frontend-cache.md](../../docs/frontend-cache.md): Why the shared loading overlay masks cold-boot auth handoffs.
