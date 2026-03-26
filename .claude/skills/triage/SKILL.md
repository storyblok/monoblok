---
name: triage
description: Quick triage assessment of GitHub issues. Use when asked to triage, assess, or categorize issues.
model: haiku
allowed-tools: Bash, Read
disable-model-invocation: true
---

# Triage GitHub Issues

Triage the following GitHub issues: $ARGUMENTS

## Current open issues (for context)

!`gh issue list --repo storyblok/monoblok --state open --limit 30 --json number,title,labels 2>/dev/null || echo "Could not fetch open issues"`

## Instructions

This is a **quick assessment** command. Spend minimal time per issue. No deep code analysis.

### Step 1: Parse issue references

Extract every issue reference from the arguments. Supported formats:
- Full URL: `https://github.com/storyblok/monoblok/issues/123`
- Short form: `#123` or just `123`
- Mixed: `#368 https://github.com/storyblok/monoblok/issues/509 464`

### Step 2: Fetch all issues in parallel

```bash
gh issue view <number> --repo storyblok/monoblok --json title,body,labels,state,comments,author,createdAt
```

### Step 3: Assess each issue

For each issue, read the title, body, labels, and comments. Determine:

| Verdict | Meaning |
|---------|---------|
| **bug** | Confirmed real bug that needs fixing |
| **feature** | Valid feature request |
| **needs-info** | Not enough information to assess |
| **not-a-bug** | Working as intended or user error |
| **duplicate** | Already tracked elsewhere |

### Step 4: Present results

Output a triage table:

```markdown
## Triage

| Issue | Title | Verdict | Package | Summary |
|-------|-------|---------|---------|---------|
| #368 | ... | bug | cli | <1-line reason> |
| #509 | ... | needs-info | cli | <what's missing> |
```

For **needs-info** issues, note what information would be needed to proceed.
For **duplicate** issues, link to the existing issue.

## Rules

- This is fast. No code analysis, no file reading, no git log. Just read the issue and assess.
- Use the package mapping from the `/investigate` skill Phase 2 to identify affected packages.
- If unsure between verdicts, lean toward **bug** (investigate further rather than dismiss).
