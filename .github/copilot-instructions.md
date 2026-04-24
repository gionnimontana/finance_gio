# Copilot Instructions for Personal Finance Bot

## Scope

Keep this file minimal. Do not duplicate project structure, endpoints, schemas, or behavior that can be discovered from the markdown entry points below.

## Entry Points

Use these files first when you need project context:
- `src/index.md` for backend navigation
- `view/index.md` for frontend navigation

Follow the linked `index.md` files inside each subfolder for deeper context.

## Documentation Rules

- Source files under `src/` should begin with a short file-scope comment.
- Frontend files under `view/` should begin with a short scope comment using the appropriate file syntax for JS, CSS, and HTML.
- Add JSDoc to named JS functions when it is missing.

## Documentation Maintenance

After every codebase change, update documentation immediately in the same change:
- Keep `src/index.md` and `view/index.md` as the two root entry points.
- Update the `index.md` file in every folder whose scope, files, links, or descriptions changed.
- When files or folders are added, removed, renamed, or repurposed, update the parent and affected `index.md` files.
- Keep all markdown docs concise, accurate, and aligned with the current codebase.
- Update this file only when the documentation workflow or the two entry points change.
