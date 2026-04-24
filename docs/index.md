# Docs

This folder contains the LLM-maintained project wiki for cross-cutting knowledge that is useful beyond a single code diff.

## Files

- [log.md](./log.md): Append-only history of notable wiki updates.
- [schema.md](./schema.md): Minimal format and maintenance rules for wiki pages.

## What Belongs Here

- Architecture notes that span backend and frontend folders.
- Contributor workflows, conventions, and troubleshooting guidance.
- Durable decisions, non-obvious behavior, and other project knowledge worth keeping current.

## What Stays Elsewhere

- [../src/index.md](../src/index.md) and [../view/index.md](../view/index.md) remain the structural entry points for backend and frontend code.
- Folder inventories, file-level behavior, and implementation details should stay in source, comments, JSDoc, or the folder-level `index.md` files unless a cross-cutting wiki page is needed.

## Next Topic Pages

Create a new page in this folder only when the topic will remain useful after the immediate task is done. Start by updating an existing page whenever possible.
