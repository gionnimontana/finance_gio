# Frontend Cache

This page documents how production frontend releases force browsers to fetch fresh files on the next page load without requiring users to hard-refresh manually.

## Current State
- Production serves the finance frontend from Nginx under `/var/www/finance.gingergio.it`.
- `deploy.sh` builds a generated frontend release tree under `.deploy/view/` before syncing files to the Nginx root.
- The release build copies deployable files from `view/`, skips source markdown docs such as the folder `index.md` pages, and appends one release-version query string to each local CSS and JS reference in the generated HTML shells.
- Nginx serves page shells such as `/login/`, `/dashboard/`, `/history/`, and `/assets/` with `Cache-Control: no-cache, no-store, must-revalidate` so browsers always revalidate HTML on navigation or reload.
- Nginx serves versioned CSS and JS files with long-lived immutable caching because the query string changes on each deploy.
- Only exact backend API endpoints continue to proxy to Express: `/auth/generate`, `/auth/validate`, `/portfolio`, `/portfolio/history`, `/portfolio/stream`, `/assets/schema`, and `/assets/view-groups`.

## Notes
- The settings page and the `/assets/schema` API share the `/assets` prefix, so the production Nginx config must use exact API route matches before the static `/assets/` page route.
- Local development and Playwright tests still serve the source `view/` tree directly from Express; the versioned URLs exist only in the generated deploy copy.
- The markdown files under `view/` remain source-only navigation docs for contributors and should never be edited inside `.deploy/view/`.
- The deploy version defaults to the current git short SHA and falls back to a timestamp when git metadata is unavailable. `PFB_FRONTEND_VERSION` can override it when a manual release identifier is needed.
- This strategy guarantees fresh frontend resources on the next page load after deploy. It does not force already-open tabs to auto-reload.

## Related
- [../view/index.md](../view/index.md)
- [../src/scripts/index.md](../src/scripts/index.md)
- [../deploy.sh](../deploy.sh)