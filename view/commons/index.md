# Commons

This folder contains the frontend assets shared across every page in the application.

## Files

- [styles.css](./styles.css): Shared layout, sticky desktop header, mobile bottom navigation, banners, tables, summary-card styling, and the dark full-screen loading overlay used during cold page boots.
- [utils.js](./utils.js): Common auth, fetch, centralized currency-aware whole-number full-value or compact absolute-value formatting with persisted Settings preferences plus opt-in forced-compact labels and no-currency overrides for exception views, privacy-aware percentage helpers, the shared authenticated asset-risk fetch helper used by dashboard badges, browser-side zero-knowledge helpers for generating secrets, deriving user ids, encrypting and decrypting opaque user blobs, transport helpers for `/user/blob` and the new stateless `/market/*` routes, shared ATH mood-title helpers, shared footer and banner utilities, and the helper that dismisses the loading overlay only after the first page render is ready.
