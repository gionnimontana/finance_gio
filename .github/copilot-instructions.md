# Copilot Instructions for Personal Finance Bot

## Scope

Keep this file minimal. Do not duplicate project structure, endpoints, schemas, or behavior that can be discovered from the markdown entry points below.

## Entry Points

Use these files first when you need project context:
- `server/index.md` for backend navigation
- `view/index.md` for frontend navigation
- `docs/index.md` for cross-cutting project knowledge

Follow the linked `index.md` files inside each subfolder for deeper context. Use `docs/schema.md` before creating or reshaping wiki pages under `docs/`.

## Documentation Scopes

- `server/**/index.md` and `view/**/index.md` describe current code structure and folder responsibilities.
- `docs/**` captures project knowledge that spans files or folders, such as architecture, workflows, conventions, troubleshooting, and durable decisions.
- Prefer updating an existing wiki page before creating a new one. Create a new page only when the topic will remain useful after the current task.

## Documentation Rules

- Backend files under `server/` should begin with a short file-scope comment.
- Frontend files under `view/` should begin with a short scope comment using the appropriate file syntax for JS, CSS, and HTML.
- Add JSDoc to named JS functions when it is missing.

## Documentation Maintenance

After every codebase change, update documentation immediately in the same change:
- Keep `server/index.md`, `view/index.md`, and `docs/index.md` as the root entry points.
- Update the `index.md` file in every folder whose scope, files, links, or descriptions changed.
- When files or folders are added, removed, renamed, or repurposed, update the parent and affected `index.md` files.
- Update `docs/` when a change affects cross-cutting knowledge that remains useful after the diff is read, such as architecture, workflows, conventions, troubleshooting, or durable decisions.
- Do not mirror every code edit into `docs/`, and do not duplicate folder inventories that already belong in `server/**/index.md` or `view/**/index.md`.
- When adding or materially revising wiki pages under `docs/`, update `docs/index.md` and append a matching entry to `docs/log.md`.
- Keep all markdown docs concise, accurate, and aligned with the current codebase.
- Update this file only when the documentation workflow or the root entry points change.
