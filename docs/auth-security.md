# Auth And Security

How identity, authentication, and browser-side credentials work, plus the security trade-offs that follow from the password-only model.

## Current State
- There are no usernames. `POST /auth/generate` creates an account by generating a password of five dash-joined Italian words, chosen with `crypto.randomInt()` from a 480-entry list (471 unique words, about 44 bits of entropy).
- The backend hashes the password with unsalted SHA-256 and uses the hex digest as the user folder name under `data/users/` or `PFB_DATA_DIR/users/`. An account exists if and only if that folder exists.
- `POST /auth/validate` answers `{ valid }` for a candidate password. Every other user route runs `authMiddleware`, which reads the `X-User-Password` header, hashes it, and rejects with `401` when the folder is missing.
- `/portfolio/stream` uses the same header. The dashboard reads the SSE stream through `fetch` so the password never appears in URLs, proxy logs, or browser history.
- Account creation is rate-limited to `PFB_ACCOUNT_CREATION_LIMIT` (default 5) per `PFB_ACCOUNT_CREATION_WINDOW_MS` (default 30 minutes). The counter is global and in-memory, so it is shared by all clients and resets on restart.
- `DELETE /auth/user` removes the whole user folder. Shared risk caches are not user data and stay in place.

## Browser State
- The raw password lives in `localStorage` as `userPassword` and is attached by `authFetch()` to each request.
- `logout()` and any `401` response call `clearUserSession()`, which removes `userPassword` plus the per-user dashboard caches: `portfolio`, `portfolioLastSuccessfulSnapshot`, `portfolioLastRefreshDelta`, `portfolioLastUpdate`, and `portfolioProgressBanner`.
- Device-level display preferences (`hideAbsoluteValues`, `useCompactAbsoluteValues`) survive logout on purpose.

## Notes
- Anyone who can read the data directory sees the password hashes as folder names. Because the hash is unsalted and fast, a leaked folder name can be brute-forced offline far more easily than the ~44-bit online space suggests. Treat the data directory as secret.
- Only account creation is rate-limited. `/auth/validate` and authenticated routes have no attempt limit, so online guessing is bounded only by network and server throughput.
- The CORS middleware answers every origin with `Access-Control-Allow-Origin: *` and allows the `X-User-Password` header. That is safe from CSRF because auth needs the secret header, but it means any page that obtains a password can call the API from a browser.
- Storing the password in `localStorage` means any XSS on the site exposes full account access; keep rendered values escaped (`escapeHtml()`).
- Production traffic must stay behind TLS; see [deploy-runtime.md](./deploy-runtime.md).

## Related
- [../server/auth/index.md](../server/auth/index.md)
- [../view/commons/index.md](../view/commons/index.md)
- [./data-model.md](./data-model.md)
- [./configuration.md](./configuration.md)
