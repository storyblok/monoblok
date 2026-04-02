---
name: triage
description: Triage GitHub issues or Linear tickets — classify type, assess priority, check reproducibility, detect duplicates. Use when asked to triage, assess, or categorize issues.
model: haiku
---

# Triage Issues

Triage the following tickets: $ARGUMENTS

## Context: Open issues

!`gh issue list --repo storyblok/monoblok --state open --limit 30 --json number,title,labels 2>/dev/null || echo "Could not fetch open issues"`

## Instructions

Read the ticket thoroughly, but do not dig into code. The goal is to classify, prioritize, and decide the next action.

### Step 1: Parse ticket references

- Anything matching `WDX-\d+` or a `linear.app` URL → **Linear**
- Anything matching `#\d+`, a bare number, or a `github.com` URL → **GitHub**
- `linear:triage` → fetch all Linear issues in Triage state (WDX team)

### Step 2: Fetch tickets

**GitHub issues:**
```bash
gh issue view <number> --repo storyblok/monoblok --json title,body,labels,state,comments,author,createdAt
```

**Linear:**
```bash
bash .claude/skills/triage/scripts/linear-fetch.sh issue WDX-123 WDX-456
bash .claude/skills/triage/scripts/linear-fetch.sh triage
```

### Step 3: Assess each ticket

#### 3a. Type classification

| Type | Description |
|------|-------------|
| **bug** | Something is broken — wrong behavior, crash, regression |
| **feature** | New capability that doesn't exist today |
| **improvement** | Enhancement to existing functionality (DX, performance, API ergonomics) |
| **documentation** | Missing, incorrect, or outdated docs |
| **question** | User asking for help, not reporting a problem |

Verify the reporter's classification if present — reporters often mislabel improvements as bugs or features as improvements. State whether confirmed or corrected.

#### 3b. Reproducibility

Rate as: `reproducible` · `likely-reproducible` · `needs-reproduction` · `not-applicable`

For **needs-reproduction**, list exactly what's missing (version, browser, minimal repro, error output, etc.).

#### 3c. Priority assessment

Score each ticket on these dimensions, then derive an overall priority.

**Impact:**
- `blocker`: Prevents core functionality, no workaround
- `critical`: Major functionality broken, workaround exists
- `degraded`: Works but with noticeable problems
- `minor`: Cosmetic, edge case, or negligible effect

**Breadth:**
- `widespread`: Affects most/all users of the package
- `common`: Common scenario
- `uncommon`: Specific configuration or setup
- `edge-case`: Rare conditions or unusual usage

**Urgency:**
- `regression`: Worked before, broke recently
- `new-defect`: Never worked, newly discovered
- `longstanding`: Has been this way for a while

**Overall priority:**

| Priority | Criteria |
|----------|----------|
| **P0 — Critical** | Blocker + widespread/common |
| **P1 — High** | Critical + common, or blocker + uncommon |
| **P2 — Medium** | Degraded + common, or critical + edge-case |
| **P3 — Low** | Minor impact, edge-case, or longstanding with easy workaround |

#### 3d. Verdict

| Verdict | When to use |
|---------|-------------|
| **actionable** | Enough info to proceed |
| **needs-info** | Cannot proceed without more information from the reporter |
| **duplicate** | Already tracked elsewhere — link to the original |
| **not-a-bug** | Working as intended, user error, or environment issue |
| **wont-fix** | Valid but out of scope or conflicts with design direction |

#### 3e. Duplicate search

Search for duplicates on every ticket:
- GitHub: `gh issue list --repo storyblok/monoblok --search "<keywords>" --state open --limit 10 --json number,title,labels`
- Linear: check `relations` field from the fetch response

If exact duplicate → mark as **duplicate** with link to original. If related but different → note the connection.

### Step 4: Present results

#### Summary table

```markdown
## Triage Summary

| Ticket | Title | Type | Priority | Verdict | Package |
|--------|-------|------|----------|---------|---------|
| #368 | ... | bug | P1 | actionable | cli |
| WDX-123 | ... | improvement | P2 | actionable | vue |
```

#### Detailed assessment (one per ticket)

```markdown
### <ticket-id>: <title>

**Source:** GitHub / Linear
**Type:** <type> (correct reporter's classification if needed)
**Reproducibility:** <assessment>
**Priority:** <P0-P3> — <label>
  - Impact: <level> (<reason>)
  - Breadth: <level> (<reason>)
  - Urgency: <level> (<reason>)
  - Related: <linked tickets if any>
**Package:** <package>
**Verdict:** <verdict>

**Summary:** <2-3 sentences>

**Suggested next step:** <what to do next>
```

For **needs-info** tickets, include a draft reply asking for the missing information.

## Output

Write results to `claude-output/triage-<identifier>.md` (e.g. `triage-424.md`, `triage-box-03-20.md`) and present the summary table directly to the user.

## Rules

- **Read-only.** Never create, update, comment on, or close issues on GitHub or Linear.
- **Always write a report.** Every triage run must produce a `claude-output/triage-<identifier>.md` file.
- **No code analysis.** Use `/investigate` for deep dives.
- When unsure, lean toward **bug** and higher priority — better to investigate than dismiss.
- For Linear triage box: process all tickets, sort output by priority (P0 first).
