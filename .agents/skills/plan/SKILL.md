---
name: plan
description:
  Use when asked to plan, design, or architect a solution, before writing implementation code
model: sonnet
effort: high
---

# Plan

Create an implementation plan for: $ARGUMENTS

## Current state

- Branch: !`git branch --show-current`
- Working tree: !`git status --short 2>/dev/null | head -20`

## Output

Write the plan to `claude-output/plan-<identifier>.md`. If requirements are unclear, ask before
planning.

````markdown
## Summary

[1-2 sentences]

## Files to Modify

| File            | Change            |
| --------------- | ----------------- |
| path/to/file.ts | Brief description |

## Implementation Steps

1. Step one

## Test Plan

- [ ] Test case 1

## Verification Commands

```bash
pnpm nx lint <package>
pnpm nx test <package>
pnpm nx test:types <package>
pnpm nx build <package>
```

## Risks/Open Questions

- Assumptions or unknowns
````
