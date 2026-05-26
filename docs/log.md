# Docs Log

This file is an append-only history of notable wiki updates.

Use one heading per entry:

```md
## [YYYY-MM-DD] update | Short title
- What changed.
- Why it mattered.
```

Supported labels are `bootstrap`, `update`, `query`, and `lint`.

## [2026-05-26] update | Add crypto risk indicators
- Added a generic asset-risk flow that keeps ISIN `SRI` badges and adds fetch-first 1-7 crypto `Risk` badges backed by Yahoo Finance history plus a shared `cryptoRiskCache.json` file.
- Refreshed the backend, frontend, and wiki entry points so contributors can find the new cache modules, crypto risk scraper, generic `/assets/risk-indicators` route, and mixed dashboard badge behavior.

## [2026-05-26] update | Add Other risk defaults and per-user overrides
- Extended the shared asset-risk flow so `Other` assets now always publish a default `Risk 1/7`, while allowing per-user integer `1-7` overrides persisted in `assetsSchema.riskOverrides` and saved through the new authenticated `/assets/risk-overrides` endpoint.
- Refreshed backend/frontend structural docs and the data-model wiki so contributors can find the `Other`-only override rules, settings-table controls, and dashboard weighted-risk behavior updates.

## [2026-05-26] update | Add gold risk indicators
- Extended the generic asset-risk flow so physical gold assets now get fetch-first 1-7 `Risk` badges backed by Yahoo Finance gold-futures history plus a shared `goldRiskCache.json` file.
- Refreshed the backend, frontend, and wiki entry points so contributors can find the gold risk cache module, gold risk scraper, and the dashboard’s mixed ISIN, crypto, and gold badge behavior.

## [2026-05-26] update | Bypass blocked WisdomTree KID page
- Updated `docs/scraper-runtime.md` with the direct dataspan fallback now used for `GB00BJYDH287`, because the public WisdomTree product page currently returns 403 to the server-side issuer fallback.
- Refreshed the scraper vendor index so the justETF adapter description now mentions the direct issuer-document fallback for blocked WisdomTree pages.

## [2026-05-26] update | Persist shared ISIN risk cache
- Updated the data-model and scraper-runtime wiki pages to document the new shared `data/isinRiskCache.json` file, which is loaded on server startup and reused across all users on the same backend.
- Refreshed the docs index and the existing ISIN risk cache topic so contributors can find the implemented startup-hydration and atomic write-through behavior from the main wiki entry points.

## [2026-05-25] update | Record ISIN risk cache plan
- Added a wiki topic page that outlines a minimal shared JSON cache for KID-derived ISIN risk indicators, including its storage location under the backend data root and the reason to keep it outside per-user folders.
- Updated the docs index so the persistent-cache plan is discoverable alongside the existing scraper-runtime and data-model notes.

## [2026-05-25] update | Add issuer fallback for ISIN KIDs
- Updated `docs/scraper-runtime.md` with the issuer-hosted PRIIP fallback now used when a justETF profile does not expose a fundinfo-style KID URL, plus the localized wording needed to parse issuer PDFs.
- Refreshed the docs and scraper structural entry points so contributors can find the new ETN fallback path from the wiki index and vendor navigation docs.

## [2026-05-24] update | Add KID-based ISIN risk scraping
- Extended the justETF scraper so ISIN assets can resolve a Synthetic Risk Indicator by discovering the linked fundinfo KID PDF and parsing its standard PRIIPs risk wording.
- Refreshed the server and scraper docs because the backend now exposes a dedicated authenticated ISIN risk endpoint alongside the existing quote and portfolio flows.

## [2026-05-22] update | Mask cold auth handoffs with shared loading overlay
- Added a shared dark loading overlay to the frontend page shells and documented that it now stays visible until login validation or the first protected-page render completes.
- Extended the frontend cache/runtime wiki notes because no-cache navigations still revalidate HTML first, so the cold-boot auth handoff behavior is now an intentional part of the source frontend.

## [2026-05-21] update | Probe deployed domain during deploy
- Updated `deploy.sh` and `finance-site.nginx.template` so deploys now reload Nginx, expose `/health` through the checked-in vhost template, and verify service health at `https://$PFB_DEPLOY_SITE_DOMAIN/health` from the server itself.
- Refreshed the deploy/runtime wiki notes because the post-restart probe now validates the live domain-backed surface instead of curling the backend directly on `127.0.0.1:8085`.

## [2026-05-21] update | Speed up crypto scraper runtime
- Updated the shared scraper runtime to avoid launching Puppeteer pages for fetch-only provider chains, so API-backed scrapes no longer pay browser startup costs.
- Refreshed the scraper wiki notes because Yahoo Finance crypto quotes now use the chart API first and only fall back to browser-backed sources when the fast path fails.

## [2026-05-21] update | Add remote deploy helper
- Added `npm run deploy:remote`, which reuses the local SSH credentials from `.env` plus `PFB_DEPLOY_APP_PATH` to run `bash ./deploy.sh` from the configured remote app directory.
- Updated the deploy/runtime wiki notes and `.env.example` so the remote repository path is configured explicitly instead of being hard-coded into the helper.

## [2026-05-21] update | Externalize deploy site domain
- Replaced the checked-in finance Nginx file with `finance-site.nginx.template` and updated `deploy.sh` to render the deploy target paths from `PFB_DEPLOY_SITE_DOMAIN` instead of keeping the production hostname hard-coded in the script and template.
- Added `.env.example` plus refreshed the deploy/runtime wiki notes so contributors know the shared `.env` file now carries the site domain used for deploy-time Nginx rendering.

## [2026-05-21] update | Redirect unknown app routes home
- Updated Express and the deployed Nginx template so unknown non-asset app URLs redirect to `/login/` instead of leaving the browser on a dead route or serving the login shell under the wrong path.
- Refreshed the frontend routing wiki notes so contributors know authenticated users still land on `/dashboard/` through the existing login-page handoff.

## [2026-05-21] update | Reload nginx after deploy config changes
- Updated `deploy.sh` to validate the rendered finance site include file with `nginx -t` and reload the live `nginx` service after the backend restart so route and cache changes in the checked-in template actually take effect on the server.
- Extended the frontend deploy wiki notes because copying the include file into `/var/www/...` is not enough to change live route handling by itself.

## [2026-05-21] update | Re-exec deploy after pull
- Updated `deploy.sh` to restart itself once when `git pull` advances the checked-out commit, so the running deploy process uses the freshly pulled script body and Nginx template instead of continuing with stale pre-pull shell code.
- Extended the frontend deploy wiki notes with the self-reexec behavior because deploy-time script updates are now part of the supported production workflow.

## [2026-04-24] bootstrap | Create docs wiki
- Added the initial `docs/` wiki shell with `index.md`, `schema.md`, and `log.md`.
- Defined `docs/` as the home for cross-cutting project knowledge rather than code-structure inventory.

## [2026-04-30] update | Document data model and cache invalidation
- Added a `docs/data-model.md` topic page that explains password-derived user storage, persisted JSON files, browser-local cache usage, and the requirement for a shared backend when using multiple devices.
- Recorded the dashboard schema-cache invalidation behavior so cross-session asset edits are easier to reason about and troubleshoot.

## [2026-04-30] update | Document scraper fallback runtime
- Added a `docs/scraper-runtime.md` topic page describing ordered provider fallback, cache TTL and stale-value reuse, and the deterministic scraper regression suite.
- Updated the scraper and portfolio structural docs so the new runtime contract and refresh normalization are discoverable from the markdown entry points.

## [2026-05-01] update | Document low-memory scraper tuning
- Extended `docs/scraper-runtime.md` with the deployment guidance for low-memory Linux servers, including the new production scraper env vars and the specific timeout pressure affecting justETF and gold scrapes.
- Updated the scraper core structural doc so the low-memory runtime behavior is discoverable from the backend entry point.

## [2026-05-01] update | Document scraper page reuse
- Updated `docs/scraper-runtime.md` with the worker-local page reuse behavior now used by live scrapes to reduce repeated Puppeteer setup cost on small VPS hosts.
- Refreshed the scraper structural docs so the runtime optimization is discoverable from the backend and docs entry points.

## [2026-05-01] update | Document frontend cache-busting deploy flow
- Added `docs/frontend-cache.md` to capture the production frontend caching strategy: HTML shells always revalidate, JS and CSS URLs are versioned during deploy, and only exact API routes proxy to Express.
- Updated the backend and frontend structural docs so the generated release build and Nginx-owned static cache policy are discoverable from the project entry points.

## [2026-05-01] update | Exclude markdown from generated frontend release
- Updated the frontend release build so `.deploy/view/` omits source markdown navigation docs and contains only deployable frontend files.
- Refreshed the cache/deploy docs so contributors know the `view/` markdown pages stay in source control only and should not be edited in generated output.

## [2026-05-01] update | Rename backend root folder to server
- Renamed the top-level backend folder from `src/` to `server/`, including the Express entrypoint, nested backend modules, and structural navigation docs.
- Updated runtime config, tests, contributor instructions, and wiki links so backend references now resolve through `server/index.md`.

## [2026-05-01] update | Document deploy runtime verification
- Updated `docs/frontend-cache.md` with the deploy-time Node-runtime pinning and post-restart backend health probe that now guard the systemd-managed API service.
- Refreshed `docs/index.md` so the deployment troubleshooting notes are discoverable from the docs entry point.

## [2026-05-01] update | Document headless scraper hardening
- Updated `docs/scraper-runtime.md` with the justETF regression where headless Chromium stopped receiving quote text unless the runtime masked obvious automation signals.
- Refreshed the scraper structural docs so the shared browser-profile hardening and new regression coverage are discoverable from the backend and docs entry points.

## [2026-05-01] update | Switch justETF to quote API
- Updated `docs/scraper-runtime.md` with the justETF quote API path now used in live refreshes, replacing the flaky rendered quote shell for ETF prices.
- Refreshed the scraper structural docs so the shared fetch-only provider path and the justETF API-based ETF scraper are discoverable from the backend and docs entry points.

## [2026-05-21] update | Cross-link metrics and state docs
- Added `docs/portfolio-metrics.md` to define the dashboard ATH baseline, the history title-mood rule, and the persisted summary baselines derived from saved history.
- Expanded `docs/data-model.md` and the structural entry points so state-model, deploy-runtime, scraper-runtime, and portfolio-metrics pages are easier to discover from the README and folder navigation docs.

## [2026-05-21] update | Raise Node runtime baseline
- Updated the repo runtime pins, contributor instructions, and CI workflow from Node 18.19.1 to Node 24.15.0 so local installs, deploys, and e2e automation share the same supported floor.
- Refreshed the deploy/runtime wiki guidance because Puppeteer 25.x now depends on a newer Node baseline than the repo used previously.

## [2026-05-21] update | Add deploy SSH helper
- Added a local-only `npm run ssh:connect` helper that reads deployed-host connection settings from `.env` and keeps the real credential file out of version control.
- Extended the deployment wiki notes so contributors know the tracked example file, strict host-key default, and optional inline-key handling used by the SSH helper.

## [2026-05-21] update | Check in finance nginx extract
- Added `finance.gingergio.it.nginx` by extracting the live `finance.gingergio.it` server block from the deployed host so future include-based Nginx refactors can start from the current production behavior.
- Updated the deploy/runtime wiki notes so contributors know the checked-in file is a local reference until `/etc/nginx/nginx.conf` is changed to include it remotely.

## [2026-05-21] update | Add password fallback to deploy SSH helper
- Extended `npm run ssh:connect` so `.env` can carry `PFB_DEPLOY_SSH_PASSWORD`, letting the helper answer SSH password prompts through a short-lived askpass script when key-based auth is unavailable.
- Updated the deploy helper example and runtime wiki notes so contributors know password auth stays local-only and is cleaned up after each SSH session.

## [2026-05-21] update | Consolidate local env files
- Renamed the SSH helper entrypoint from `npm run ssh:deploy` to `npm run ssh:connect` so the command name matches its purpose more closely.
- Consolidated the documented local configuration around one shared `.env` file and replaced `.env.deploy.example` with `.env.example`.

## [2026-05-21] update | Include nginx config in deploy artifact
- Updated `deploy.sh` so the generated `.deploy/` output now includes `finance.gingergio.it.nginx` alongside the versioned frontend release files.
- Refreshed the deployment wiki notes so contributors know the deploy artifact now carries the checked-in Nginx reference file as well as the static frontend tree.

## [2026-05-21] update | Deploy nginx include file
- Updated `deploy.sh` so deploys now install `finance.gingergio.it.nginx` into `/var/www/finance.gingergio.it/finance.gingergio.it.nginx` on the server, keeping the live include file aligned with the checked-in config.
- Refreshed the finance Nginx reference and deployment wiki notes so contributors know `/etc/nginx/nginx.conf` should include the deployed file instead of embedding the finance server block inline.

## [2026-05-22] update | Generalize nginx template naming
- Renamed the checked-in Nginx server-block template from `finance-site.nginx.template` to `site.nginx.template` so deploy assets are named generically and no longer finance-specific.
- Updated `deploy.sh` and deploy/runtime wiki references so template rendering and contributor documentation stay aligned with the new generic template name.

## [2026-05-22] update | Document account deletion lifecycle
- Extended `docs/data-model.md` so the password-derived storage notes now cover full user-folder deletion from Settings and the accompanying local logout behavior.
- Refreshed the docs index because the settings flow now includes irreversible account removal alongside the existing per-user JSON persistence model.
