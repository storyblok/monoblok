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

## Context

Read the relevant context files based on what you're implementing:

- `.claude/context/cli-architecture.md` - CLI patterns (commands, session, errors, UI module, spinners)
- `.claude/context/testing-patterns.md` - Testing conventions (memfs, msw, Windows compat)
- `.claude/context/storyrails.md` - When implementing API interactions, verify endpoints and error handling
- `.claude/context/storyfront.md` - When implementing bridge protocol or visual editor changes
- `.claude/context/storyblok-kotlin.md` - When implementing Kotlin/Android SDK changes
- `.claude/context/storyblok-swift.md` - When implementing Swift/Apple SDK changes

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
