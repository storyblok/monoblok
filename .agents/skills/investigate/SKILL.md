---
name: investigate
description: Deep investigation of GitHub issues with root cause analysis and proposed solutions. Use when asked to investigate, analyze, or dig into an issue.
model: opus
context: fork
agent: investigator
effort: high
---

# Investigate GitHub Issue

Investigate the following GitHub issue: $ARGUMENTS

## Instructions

### Phase 1: Fetch Issue Details

1. Parse the input (full URL, `#123`, or `123`)
2. Fetch with `gh issue view <number> --json title,body,labels,comments,author,createdAt,state`
3. Extract: error messages, stack traces, reproduction steps, environment details

### Phase 2: Identify Affected Package(s)

1. Check issue labels for `pkg:*` tags
2. Search title/body for package names or import statements
3. Check stack traces for file paths
4. Package folders are in `packages/` — use labels and keywords to identify

### Phase 3: Deep Analysis

1. Search for error messages and referenced functions in the codebase
2. Trace the execution path from entry point to the reported behavior
3. Check recent commits: `git log --oneline -20 -- packages/<name>`
4. Search similar issues: `gh issue list --search "<keywords>" --state all --limit 10`

### Phase 4: Root Cause Analysis

Determine category: bug in logic, API change, type mismatch, missing validation, race condition, environment issue, configuration, or documentation gap.

### Phase 5: Propose Solutions

For each root cause: the fix (file paths + line numbers), test coverage needed, verification commands.

## Output

1. Extract identifier from arguments (issue `424` → `424`, ticket `WDX-296` → `WDX-296`, text → slugified)
2. `mkdir -p claude-output`
3. Write to `claude-output/investigate-<identifier>.md`
4. Confirm to user: "Investigation written to `claude-output/investigate-<identifier>.md`"

### Output Structure

```markdown
# Investigation: Issue #<number>

**Title:** | **URL:** | **Created:** | **State:** | **Author:**

## Summary
## Affected Package(s) (table: Package, Confidence, Evidence)
## Issue Details (Reported Behavior, Expected Behavior, Environment, Reproduction Steps)
## Code Analysis (Relevant Files table, Execution Flow, Code snippets)
## Root Cause (Category, Explanation, Evidence)
## Proposed Solutions (Changes table, Code before/after, Tests to add, Verification)
## Similar Issues
## Notes / Risks
## Next Steps
```
