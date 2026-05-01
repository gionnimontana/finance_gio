# Scripts

This folder holds higher-level backend business logic plus release-build helpers that support deployment.

## Direct Files

- [buildFrontendRelease.js](./buildFrontendRelease.js): Copies the frontend into a deploy artifact tree and appends one release version query string to local CSS and JS references so production browsers fetch fresh assets after each deploy.

## Subfolders

- [portfolio/index.md](./portfolio/index.md): Portfolio aggregation and streaming orchestration.
- [portfolio/index.js](./portfolio/index.js): Builds grouped portfolio totals plus all-time-high summary metadata from the asset schema, saved history, and live scraper results.