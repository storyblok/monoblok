---
name: plan
description: Create an implementation plan for a task. Use when asked to plan, design, or architect a solution.
model: sonnet
allowed-tools: Bash, Read, Grep, Glob
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

## Context

Read the relevant context files based on what you're planning:

- `.claude/context/cli-architecture.md` - CLI patterns (commands, session, errors, UI module)
- `.claude/context/testing-patterns.md` - Testing conventions (memfs, msw, Windows compat)
- `.claude/context/storyrails.md` - Backend API contracts, endpoints, error codes, model constraints. Explore the storyrails repo for deeper understanding (routes, controllers, models, serializers)
- `.claude/context/docs-platform.md` - When planning documentation changes (site structure, navigation, versioning)
- `.claude/context/storyfront.md` - When planning visual editor or bridge protocol changes. Explore the storyfront repo
- `.claude/context/storyblok-kotlin.md` - When planning Kotlin/Android SDK work. Explore the storyblok-kotlin repo
- `.claude/context/storyblok-swift.md` - When planning Swift/Apple SDK work. Explore the storyblok-swift repo
