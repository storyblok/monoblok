---
name: review-and-qa
description: Use when asked to review a commit, branch, or PR, or to produce a QA plan for changes
model: opus
context: fork
agent: reviewer
effort: high
---

# Review Changes

Review the changes for: $ARGUMENTS.

## Phase 1: Code review

Review against the root `AGENTS.md`, the affected package's `AGENTS.md`, and
`docs/testing-patterns.md`. Check in particular:

- [ ] **Small diff** - One logical change. If the PR does multiple things, split it.
- [ ] **Tests** - Behavior changes have integration coverage; bug fixes have a regression test.
- [ ] **No secrets** - No tokens, passwords, or credentials in code, fixtures, or test scripts.
- [ ] **Commit type** - `fix`/`feat` only for changes consumers can observe; everything else is
      `chore`.
- [ ] **Docs** - User-facing changes have a `DOCS.md` draft (see `docs/docs-platform.md`).
- [ ] **Errors** - New error messages say what went wrong and how to fix it.
- [ ] **Breaking changes** - Migration notes with before/after examples; deprecation warnings when
      an old API stays temporarily.
- [ ] **Dependencies** - Justified, latest version, MIT-compatible license.
- [ ] **OpenAPI** - Changes under `tools/openapi-codegen/` come with regenerated output for every
      consumer.
- [ ] **CLI** - Every spinner stopped on all return paths; prompts pass `stderrPromptContext`; paths
      via `pathe`.

### Output format (code review)

```markdown
## Code review summary

[LGTM / Needs changes / Blocking issues]

## Issues found

### [Critical/Major/Minor]: Issue title

**File:** `path/to/file.ts:123` **Problem:** Description. **Suggestion:** How to fix.
```

## Phase 2: QA review

### Test case structure

For test plan structure, see `templates/test-plan.md` and `examples/assets-test-plan.md`.

### Coverage requirements

Create test cases for:

1. **Happy path** - Normal successful operation.
2. **Negative cases** - Invalid input, unauthorized access, and missing data.
3. **Edge cases** - Empty input, large input, and special characters.
4. **Error recovery** - What happens when things fail mid-operation.

## Output

Write the review to `claude-output/review-<identifier>.md` (PR `#435` → `review-435.md`, branch or
free text → slugified).
