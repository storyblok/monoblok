---
name: blitz
description: Drive multiple GitHub issues through the full pipeline (triage, investigate, plan, implement) in parallel. Use when asked to blitz, batch-process, or work multiple issues.
model: opus
disable-model-invocation: true
effort: high
---

# Blitz

Blitz the following GitHub issues: $ARGUMENTS

## Overview

Drive multiple issues through the full pipeline in parallel:
**triage -> investigate -> worktree -> plan -> implement**

Composes existing skills: `/triage` for assessment, `/investigate` for root cause analysis, `/plan` for approach design, `/implement` for execution.

## Instructions

### Phase 1: Triage

Follow the `/triage` skill methodology:
1. Parse all issue references from arguments
2. Fetch all issues in parallel
3. Quick-assess each issue (bug, feature, needs-info, not-a-bug, duplicate)

Present the triage table and **ask the user to confirm** which issues to proceed with before continuing. The user may adjust verdicts or exclude issues.

### Phase 2: Investigate

For each confirmed issue, run a deep investigation following the `/investigate` skill methodology (Phases 1-5).

- Use subagents to investigate multiple issues **in parallel**
- Write each investigation to `claude-output/investigate-<id>.md`
- Present a summary of root causes and proposed solutions

### Phase 3: Workspace setup

Create worktrees **only when multiple issues are confirmed for implementation**:
- Single issue: work in the current tree (no worktree needed)
- Multiple issues: create a worktree per issue for parallel work

Use the bundled script:
```bash
bash .claude/skills/blitz/scripts/monotree.sh add <branch-name>
bash .claude/skills/blitz/scripts/monotree.sh remove <branch-name>
bash .claude/skills/blitz/scripts/monotree.sh list
```

**IMPORTANT:** Create worktrees **sequentially**, one at a time. The script runs `git worktree add`, `pnpm install`, and `pnpm nx build` which are not safe to run in parallel (git index locks, pnpm store contention, Nx cache races). Wait for each to complete before starting the next.

### Phase 4: Plan

For each issue, create an implementation plan following the `/plan` skill methodology:
- Identify files to modify, implementation steps, test plan
- Ground the plan in the root cause and proposed solution from Phase 2

When working in worktrees, plan within each worktree's context.

Present all plans and **ask the user to approve** before implementing.

### Phase 5: Implement

For each approved plan, implement following the `/implement` skill methodology:
- Small diffs, no scope creep
- Run lint/test/typecheck after changes
- Use subagents to implement across worktrees **in parallel**

### Phase 6: Summary

Present final status:

```markdown
## Blitz Summary

| Issue | Status | Investigation | Worktree | Branch |
|-------|--------|---------------|----------|--------|
| #368 | implemented | `investigate-368.md` | `fix-368` | `fix-368` |
| #509 | planned | `investigate-509.md` | `fix-509` | `fix-509` |

### Results
- **#368:** <what was done, verification status>
- **#509:** <what was done, what's pending>
```

## Checkpoints

This skill pauses for user input at two points:
1. **After triage** (Phase 1) - confirm which issues to investigate
2. **After planning** (Phase 4) - approve plans before implementation

## Rules

- Always pause at checkpoints. Never skip user confirmation.
- Investigations and implementations run in parallel via subagents when possible.
- Each phase builds on the previous: investigation informs planning, planning guides implementation.
- Follow each composed skill's methodology exactly. This skill orchestrates, it doesn't replace them.
- If any phase fails for an issue (e.g., investigation finds it's not reproducible), update the summary and continue with the remaining issues.
