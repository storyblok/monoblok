---
name: implement
description: Execute an approved implementation plan. Use when asked to implement, build, or code a planned change.
model: opus
effort: high
---

# Implement

Implement the approved plan: $ARGUMENTS

## Current state

- Branch: !`git branch --show-current`
- Working tree: !`git status --short 2>/dev/null | head -20`

## Instructions

1. **Follow the plan** - Execute the steps from the approved plan
2. **Small diffs** - Make one logical change at a time
3. **No scope creep** - Only implement what was planned
4. **Verify as you go** - Run relevant checks after each change

## Rules
- Do NOT add new dependencies unless explicitly in the plan
- Do NOT refactor unrelated code
- Do NOT add comments/docs unless specifically requested
- Preserve existing code style and patterns

## Output Format

```markdown
## Changes Made
| File | Change |
|------|--------|
| path/to/file.ts | What changed |

## Verification
\`\`\`bash
# Commands run and output
pnpm nx lint <package>
pnpm nx test <package>
pnpm nx run <package> test:types
\`\`\`

## Notes
- Any deviations from plan (with justification)
- Any follow-up items discovered
```

## Post-Implementation Checklist
- [ ] All planned changes completed
- [ ] Lint passes: `pnpm nx lint <package>`
- [ ] Tests pass: `pnpm nx test <package>`
- [ ] Types check: `pnpm nx run <package> test:types`
