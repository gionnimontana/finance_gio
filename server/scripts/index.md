# Scripts

This folder holds higher-level backend business logic plus release-build and deploy-access helpers.

## Direct Files

- [buildFrontendRelease.js](./buildFrontendRelease.js): Copies the frontend into a deploy artifact tree, excludes source markdown docs from the generated output, and appends one release version query string to local CSS and JS references so production browsers fetch fresh assets after each deploy.
- [connectDeployServer.js](./connectDeployServer.js): Opens an SSH session or runs a one-off remote command against the deployed host by reading local settings from `.env`, supporting both key-based auth and env-backed password auth while keeping strict host-key checking enabled by default.
- [runRemoteDeploy.js](./runRemoteDeploy.js): Reuses the SSH helper settings from `.env`, reads `PFB_DEPLOY_APP_PATH`, and runs `bash ./deploy.sh` inside the configured remote app directory on the deployed host.
- [ensureBrowserRuntimes.js](./ensureBrowserRuntimes.js): Verifies the local Playwright and Puppeteer browser caches needed by the e2e suite, installing the missing runtime only when its executable is absent.
- [marketData.js](./marketData.js): Resolves stateless quotes and asset risk indicators from explicit asset descriptors, returning only market data needed by the zero-knowledge browser flow without reading persisted user schema or history.
- [riskIndicators.js](./riskIndicators.js): Resolves the shared asset-risk API payload by merging KID-derived ISIN SRI values with fetch-first crypto and physical-gold risk scores, adds default `Risk 1/7` values for `Other` assets, applies per-user `riskOverrides` for those `Other` assets, and keeps the legacy ISIN-only route compatible.

## Subfolders

- [portfolio/index.md](./portfolio/index.md): Portfolio aggregation and streaming orchestration.
- [portfolio/index.js](./portfolio/index.js): Builds grouped portfolio totals plus all-time-high summary metadata from the asset schema, saved history before the current month, and live scraper results.
