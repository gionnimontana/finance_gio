# Testing

Which test suites exist, how they isolate data and scrapers, and where each one runs.

## Current State
- `npm run test:server` runs the `node:test` files in `tests/server/*.test.js`. They cover auth deletion, deploy helpers, risk caches and scorers, KID parsing, portfolio ATH and history writes, and the scraper unexpected-abort path. Use the glob; `node --test tests/server/` fails.
- `npm run test:e2e` runs the full Playwright suite in `tests/e2e/specs/`. `npm run test:e2e:smoke` runs only tests tagged `@smoke`, and `npm run test:e2e:headed` opens a visible browser.
- `npm test` runs the server suite, then the full e2e suite.
- The pre-commit hook (`simple-git-hooks`) runs `test:server` and `test:e2e:smoke`. After changing the hook command in `package.json`, rerun `npx simple-git-hooks`.
- CI (`.github/workflows/e2e.yml`) runs `test:server` and then `test:e2e` on Node 24.15.0 for pushes to `main` and pull requests.

## E2E Isolation
- Playwright starts `node server/index.js` on port `PLAYWRIGHT_TEST_PORT` (default 4185) with `PFB_TEST_MODE=1`, `PFB_DATA_DIR=tests/e2e/.runtime/data`, and `PFB_TEST_FIXTURE_PATH=tests/e2e/fixtures/mock-scraper.json`.
- `PFB_TEST_MODE=1` replaces live scrapers with fixture values, so dashboard flows never hit third-party sites.
- `npm run e2e:reset` (run automatically by the e2e scripts) rebuilds seeded users and history through `tests/e2e/setup/resetTestData.js`.
- `tests/e2e/specs/scrapers.spec.js` exercises parsers and fallback logic against checked-in HTML under `tests/e2e/fixtures/scrapers/`.
- Specs mock backend routes with `page.route()`; stream mocks match `/portfolio/stream?refresh=(true|false)` and can assert the `X-User-Password` header.

## Notes
- Server tests that touch disk swap `PFB_DATA_DIR` to a temp folder and clear the `require` cache so modules pick up the new path.
- `npm run browsers:install` installs both the Playwright and Puppeteer browsers; rerun it after changing Node versions.

## Related
- [../README.md](../README.md)
- [./scraper-runtime.md](./scraper-runtime.md)
- [./configuration.md](./configuration.md)
