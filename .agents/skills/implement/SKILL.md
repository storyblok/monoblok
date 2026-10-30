---
name: implement
description: Use when asked to implement, build, or code a change that has an approved plan
model: opus
effort: high
---

# Implement

Implement the approved plan: $ARGUMENTS

## Current state

- Branch: !`git branch --show-current`
- Working tree: !`git status --short 2>/dev/null | head -20`

## Rules

- Implement only what the plan covers. No new dependencies unless planned, no unrelated refactors.
- Don't add comments that restate code. Draft user-facing docs in `DOCS.md` (see
  `docs/docs-platform.md`).
- Before finishing, run for every affected package:

  ```bash
  pnpm nx lint <package>
  pnpm nx test <package>
  pnpm nx test:types <package>
  pnpm nx build <package>
  ```

## Output

````markdown
## Changes Made

| File            | Change       |
| --------------- | ------------ |
| path/to/file.ts | What changed |

## Verification

```bash
# Commands run and their result
```

## Notes

- Deviations from the plan (with justification)
- Follow-up items discovered
````
