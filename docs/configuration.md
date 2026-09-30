# Configuration

Every environment variable the code reads, with defaults. The server, `deploy.sh`, and the SSH helpers read the gitignored repo-root `.env` as well as the shell environment; `.env.example` lists the deploy-side variables.

## Server
| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8085` | Express listen port. |
| `PFB_DATA_DIR` | `data/` | Root for `users/` and the shared risk-cache files. |
| `PFB_ACCOUNT_CREATION_LIMIT` | `5` | Accounts allowed per window (global, in-memory). |
| `PFB_ACCOUNT_CREATION_WINDOW_MS` | `1800000` | Rolling window for the account-creation limit. |

## Scraper Runtime
| Variable | Default | Purpose |
| --- | --- | --- |
| `PFB_SCRAPER_CONCURRENCY` | `3` (`1` on low-memory hosts) | Parallel scrape workers. |
| `PFB_SCRAPER_TIMEOUT_MS` | `5000` (`12000` low-memory) | Default navigation timeout. |
| `PFB_SCRAPER_SELECTOR_TIMEOUT_MS` | `3500` (`8000` low-memory) | Default selector wait. |
| `PFB_SCRAPER_ETF_TIMEOUT_MS` | `14000` | justETF navigation timeout. |
| `PFB_SCRAPER_ETF_SELECTOR_TIMEOUT_MS` | `9000` | justETF selector wait. |
| `PFB_SCRAPER_GOLD_TIMEOUT_MS` | `10000` | Gold price navigation timeout. |
| `PFB_SCRAPER_GOLD_SELECTOR_TIMEOUT_MS` | `7000` | Gold price selector wait. |
| `PFB_SCRAPER_CRYPTO_API_TIMEOUT_MS` | `2500` | Yahoo Finance chart API timeout. |
| `PFB_SCRAPER_CACHE_TTL_MS` | `300000` | Fresh cache window (risk families override to 24 h). |
| `PFB_SCRAPER_STALE_CACHE_TTL_MS` | `43200000` | Stale-recovery window. |
| `PFB_SCRAPER_LOW_MEMORY_THRESHOLD_BYTES` | 3 GB | `os.totalmem()` at or below this enables low-memory defaults. |
| `PFB_SCRAPER_USER_AGENT` | Desktop Chrome UA | Browser profile user agent. |
| `PFB_SCRAPER_ACCEPT_LANGUAGE` | `en-US,en;q=0.9` | Browser profile language header. |

`deploy.sh` writes a fixed low-memory profile for concurrency and all six timeouts into the systemd unit; see [deploy-runtime.md](./deploy-runtime.md).

## Tests
| Variable | Default | Purpose |
| --- | --- | --- |
| `PFB_TEST_MODE` | unset | `1` replaces live scrapers with fixtures. |
| `PFB_TEST_FIXTURE_PATH` | unset | JSON fixture file used in test mode. |
| `PLAYWRIGHT_TEST_PORT` | `4185` | Port for the Playwright web server. |

## Deploy And SSH Helpers
| Variable | Default | Purpose |
| --- | --- | --- |
| `PFB_DEPLOY_SITE_DOMAIN` | required | Domain rendered into the Nginx template and `/var/www/<domain>`. |
| `PFB_DEPLOY_APP_PATH` | required for `deploy:remote` | Remote repo directory that runs `deploy.sh`. |
| `PFB_DEPLOY_SSH_HOST`, `PFB_DEPLOY_SSH_USER` | required | SSH target. |
| `PFB_DEPLOY_SSH_PORT` | `22` | SSH port. |
| `PFB_DEPLOY_SSH_PRIVATE_KEY_PATH` or `PFB_DEPLOY_SSH_PRIVATE_KEY` | unset | Key file path or inline key; set only one. |
| `PFB_DEPLOY_SSH_PASSWORD` | unset | Local-only password fallback via a temporary askpass script. |
| `PFB_DEPLOY_SSH_STRICT_HOST_KEY_CHECKING` | `true` | Disable only for new hosts or intentional key rotation. |
| `PFB_DEPLOY_SSH_KNOWN_HOSTS_PATH` | system default | Custom known-hosts file. |
| `PFB_FRONTEND_VERSION` | git short SHA | Override for the release asset version string. |
| `PFB_DEPLOY_REEXEC_AFTER_PULL` | internal | Guard set by `deploy.sh` when it re-execs after `git pull`; do not set manually. |

## Related
- [./deploy-runtime.md](./deploy-runtime.md)
- [./scraper-runtime.md](./scraper-runtime.md)
- [./testing.md](./testing.md)
- [./auth-security.md](./auth-security.md)
