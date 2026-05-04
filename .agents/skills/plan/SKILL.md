---
name: plan
description: Create an implementation plan for a task. Use when asked to plan, design, or architect a solution.
model: sonnet
effort: high
---

# Plan

Create an implementation plan for: $ARGUMENTS

## Current state

- Branch: !`git branch --show-current`
- Working tree: !`git status --short 2>/dev/null | head -20`

## Instructions

1. **Understand the request** - Read relevant files to understand current state
2. **Identify scope** - What files need to change? What's the impact?
3. **Design approach** - How will you implement this?
4. **Plan tests** - What tests will verify correctness?

## Output Format

```markdown
## Summary
[1-2 sentences describing what this plan achieves]

## Files to Modify
| File | Change |
|------|--------|
| path/to/file.ts | Brief description |

## Implementation Steps
1. Step one
2. Step two
3. ...

## Test Plan
- [ ] Test case 1
- [ ] Test case 2

## Verification Commands
\`\`\`bash
pnpm nx lint <package>
pnpm nx test <package>
pnpm nx run <package> test:types
\`\`\`

## Risks/Open Questions
- Any assumptions or unknowns
```

## Output

Write the plan to `claude-output/plan-<identifier>.md`.

## Rules
- Keep the plan focused and actionable
- Only include files that actually need changes
- Verification commands must be real and runnable
- If requirements are unclear, ask before planning
