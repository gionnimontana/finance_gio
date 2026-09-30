# Auth

This folder manages password generation, user-folder lifecycle, account deletion, and request authentication for protected endpoints.

## Files

- [index.js](./index.js): Generates account passwords with `crypto.randomInt()`, hashes credentials, creates or deletes user data folders, rate-limits account creation, and exposes the Express auth handlers and middleware.

## Related Docs

- [../../docs/data-model.md](../../docs/data-model.md): Password-derived user folders, browser-local login state, and account deletion.
- [../../docs/auth-security.md](../../docs/auth-security.md): Security model, entropy, rate limits, and CORS trade-offs.