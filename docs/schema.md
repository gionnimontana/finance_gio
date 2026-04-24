# Docs Schema

Keep the wiki small, current, and easy to maintain.

## Page Types

- `index.md`: Navigation page for a folder or section.
- `log.md`: Append-only chronology of notable wiki activity.
- Topic page: A durable note about architecture, workflows, conventions, troubleshooting, or decisions.

## When To Update

- Update an existing wiki page when the topic already exists.
- Create a new topic page only when the knowledge is cross-cutting and likely to stay useful after the current task.
- Add or update a `docs/log.md` entry when the wiki is created or materially revised.

## When Not To Use The Wiki

- Do not duplicate folder inventories already covered by [../src/index.md](../src/index.md) or [../view/index.md](../view/index.md).
- Do not mirror routine implementation edits that are already obvious from the code change.
- Do not use `docs/` as a dumping ground for temporary task notes.

## Topic Page Template

```md
# Topic Title

Short statement of scope and why the topic matters.

## Current State
- Brief factual bullets.

## Notes
- Cross-cutting details, caveats, or decisions.

## Related
- [Relevant structural doc](../src/index.md)
- [Relevant code or frontend doc](../view/index.md)
```

## Style

- Prefer short markdown pages over long narratives.
- Link to existing structural docs instead of restating them.
- Keep statements factual and current.
