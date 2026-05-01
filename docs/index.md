# Docs

This folder contains the LLM-maintained project wiki for cross-cutting knowledge that is useful beyond a single code diff.

## Files

- [data-model.md](./data-model.md): Cross-cutting notes about password-derived user storage, persisted JSON files, browser-local caches, and cross-device synchronization behavior.
- [frontend-cache.md](./frontend-cache.md): Production frontend cache-control and deploy-runtime notes covering Nginx ownership of static pages, deploy-time asset versioning, generated release contents, backend health verification, and the exact API routes that still proxy to Express.
- [scraper-runtime.md](./scraper-runtime.md): Fallback-provider runtime notes covering page reuse, cache TTLs, stale-value reuse, and deterministic scraper regression tests.
- [log.md](./log.md): Append-only history of notable wiki updates.
- [schema.md](./schema.md): Minimal format and maintenance rules for wiki pages.

## What Belongs Here

- Architecture notes that span backend and frontend folders.
- Contributor workflows, conventions, and troubleshooting guidance.
- Durable decisions, non-obvious behavior, and other project knowledge worth keeping current.

## What Stays Elsewhere

- [../server/index.md](../server/index.md) and [../view/index.md](../view/index.md) remain the structural entry points for backend and frontend code.
- Folder inventories, file-level behavior, and implementation details should stay in source, comments, JSDoc, or the folder-level `index.md` files unless a cross-cutting wiki page is needed.

## Next Topic Pages

Create a new page in this folder only when the topic will remain useful after the immediate task is done. Start by updating an existing page whenever possible.
