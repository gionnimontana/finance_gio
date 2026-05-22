# Frontend Cache

This page documents how production frontend releases force browsers to fetch fresh files on the next page load without requiring users to hard-refresh manually.

## Current State
- Production serves the finance frontend from Nginx under `/var/www/$PFB_DEPLOY_SITE_DOMAIN`.
- `deploy.sh` loads `PFB_DEPLOY_SITE_DOMAIN` from `.env` or the current shell, builds a generated frontend release tree under `.deploy/view/`, renders the checked-in `site.nginx.template` into `.deploy/$PFB_DEPLOY_SITE_DOMAIN.nginx`, syncs the frontend files to the Nginx root, and installs the matching Nginx include file at `/var/www/$PFB_DEPLOY_SITE_DOMAIN/$PFB_DEPLOY_SITE_DOMAIN.nginx`.
- `deploy.sh` validates the rendered include with `nginx -t`, reloads the `nginx` service, and then verifies backend health through the deployed domain so route changes in the checked-in template are live before the health probe runs.
- `deploy.sh` resolves the active `node` binary before writing the systemd unit, so the long-running backend uses the same runtime that satisfied the repo's Node engine requirement during deploy. The current repo baseline is Node 24.15.0.
- `npm run ssh:connect` opens an SSH session to the deployed host by reading connection settings from the gitignored `.env` file or the current shell environment.
- `npm run ssh:connect` accepts `PFB_DEPLOY_SSH_PASSWORD` as an optional local-only fallback, letting the helper satisfy password prompts non-interactively through `SSH_ASKPASS` when the host does not accept the local keychain.
- `npm run deploy:remote` reuses the same SSH credentials plus `PFB_DEPLOY_APP_PATH` to change into the remote app directory and run `bash ./deploy.sh` on the server.
- The release build copies deployable files from `view/`, skips source markdown docs such as the folder `index.md` pages, and appends one release-version query string to each local CSS and JS reference in the generated HTML shells.
- Nginx serves page shells such as `/login/`, `/dashboard/`, `/history/`, and `/assets/` with `Cache-Control: no-cache, no-store, must-revalidate` so browsers always revalidate HTML on navigation or reload.
- Unknown non-asset GET paths now redirect to `/login/` instead of serving the login HTML from the wrong URL, letting the login page normalize authenticated users onward to `/dashboard/`.
- Nginx serves versioned CSS and JS files with long-lived immutable caching because the query string changes on each deploy.
- The deployed Nginx config is expected to proxy only exact backend endpoints to Express: `/health`, `/auth/generate`, `/auth/validate`, `/portfolio`, `/portfolio/history`, `/portfolio/stream`, `/assets/schema`, and `/assets/view-groups`.
- The checked-in site template lives in `../site.nginx.template` so deploys can render a domain-specific Nginx include file from one source template instead of keeping the production hostname hard-coded in the repo.

## Notes
- The settings page and the `/assets/schema` API share the `/assets` prefix, so the production Nginx config must use exact API route matches before the static `/assets/` page route.
- `site.nginx.template` is the checked-in site server-block template, and `deploy.sh` renders it into `.deploy/$PFB_DEPLOY_SITE_DOMAIN.nginx` before installing it at `/var/www/$PFB_DEPLOY_SITE_DOMAIN/$PFB_DEPLOY_SITE_DOMAIN.nginx` on the host.
- `/etc/nginx/nginx.conf` should include `/var/www/$PFB_DEPLOY_SITE_DOMAIN/$PFB_DEPLOY_SITE_DOMAIN.nginx` from the remote `http { ... }` block so future deploys update the live finance site config without hand-editing the main file.
- Updating the include file on disk is not enough by itself; Nginx only starts serving route changes after a successful reload.
- Local secrets belong in `.env`, which is ignored by git. `.env.example` documents the supported app and deploy variables, including `PFB_DEPLOY_SITE_DOMAIN` plus the current remote app path setting `PFB_DEPLOY_APP_PATH=/home/financegio`, and should stay credential-free.
- Prefer `PFB_DEPLOY_SSH_PRIVATE_KEY_PATH` over embedding a raw key, but the helper also accepts `PFB_DEPLOY_SSH_PRIVATE_KEY` and writes it to a temporary `0600` file for the duration of the session.
- When a server still requires password auth, set `PFB_DEPLOY_SSH_PASSWORD` locally; the helper writes a short-lived askpass script in a temp directory and removes it after the session ends.
- `npm run deploy:remote` intentionally shells into `PFB_DEPLOY_APP_PATH` and delegates to the checked-in `deploy.sh`, so the remote host keeps using the same deploy workflow, Nginx template rendering, and post-restart health verification through the deployed domain as a manual SSH session.
- Host verification stays on by default. Only set `PFB_DEPLOY_SSH_STRICT_HOST_KEY_CHECKING=false` when bootstrapping a new host or handling an intentional host-key rotation.
- Local development and Playwright tests still serve the source `view/` tree directly from Express; the versioned URLs exist only in the generated deploy copy, and Express mirrors production by redirecting unknown non-asset app URLs to `/login/`.
- The deploy script now reloads Nginx and probes `https://$PFB_DEPLOY_SITE_DOMAIN/health` from the server with `curl --resolve ...:443:127.0.0.1`, so deploys verify the live TLS vhost and the backend together without depending on public DNS or a localhost-only app binding.
- The markdown files under `view/` remain source-only navigation docs for contributors and should never be edited inside `.deploy/view/`.
- The deploy version defaults to the current git short SHA and falls back to a timestamp when git metadata is unavailable. `PFB_FRONTEND_VERSION` can override it when a manual release identifier is needed.
- When `git pull` updates the checked-out commit, `deploy.sh` immediately re-execs itself once before continuing so the active deploy process uses the freshly pulled script and template files instead of any stale pre-pull shell state.
- This strategy guarantees fresh frontend resources on the next page load after deploy. It does not force already-open tabs to auto-reload.

## Related
- [../view/index.md](../view/index.md)
- [../server/scripts/index.md](../server/scripts/index.md)
- [../deploy.sh](../deploy.sh)
- [../site.nginx.template](../site.nginx.template)
