---
name: triage
description: Use when asked to triage, assess, or categorize GitHub issues or Linear tickets
model: sonnet
---

# Triage Issues

Triage the following tickets: $ARGUMENTS

## Context: Open issues

!`gh issue list --repo storyblok/monoblok --state open --limit 30 --json number,title,labels 2>/dev/null || echo "Could not fetch open issues"`

## Instructions

Read the ticket thoroughly, but do not dig into code. The goal is to classify, prioritize, and
decide the next action.

### Step 1: Parse ticket references

- Anything matching `DX-\d+` or a `linear.app` URL → **Linear**
- Anything matching `#\d+`, a bare number, or a `github.com` URL → **GitHub**
- `linear:triage` → fetch all Linear issues in Triage state (DX team)

### Step 2: Fetch tickets

**GitHub issues:**

```bash
gh issue view <number> --repo storyblok/monoblok --json title,body,labels,state,comments,author,createdAt
```

**Linear:**

```bash
bash .agents/skills/triage/scripts/linear-fetch.sh issue DX-123 DX-456
bash .agents/skills/triage/scripts/linear-fetch.sh triage
```

Linear steps apply only to `DX-` tickets; skip them for GitHub-only runs.

**Fix PRs:** `bash .agents/skills/triage/scripts/linked-prs.sh 866 DX-123` lists open PRs that close
each ticket in `byIssue` (newest first, the first is the fix) and PRs that merely mention a GitHub
issue in `related` (always empty for `DX-` ids). If none, one `gh pr list --search "<keywords>"` is
enough.

### Step 3: Assess each ticket

#### 3a. Type classification

| Type              | Description                                                             |
| ----------------- | ----------------------------------------------------------------------- |
| **bug**           | Something is broken — wrong behavior, crash, regression                 |
| **feature**       | New capability that doesn't exist today                                 |
| **improvement**   | Enhancement to existing functionality (DX, performance, API ergonomics) |
| **documentation** | Missing, incorrect, or outdated docs                                    |
| **question**      | User asking for help, not reporting a problem                           |

Verify the reporter's classification if present — reporters often mislabel improvements as bugs or
features as improvements. State whether confirmed or corrected.

#### 3b. Reproducibility

Rate as: `reproducible` · `likely-reproducible` · `needs-reproduction` · `not-applicable`

For **needs-reproduction**, list exactly what's missing (version, browser, minimal repro, error
output, etc.).

#### 3c. Priority assessment

Read `.agents/skills/triage/calibration.md` first and match the ticket against it. Then score each
ticket on these dimensions and derive an overall priority.

**Impact:**

- `blocker`: Prevents core functionality, no workaround. If any workaround exists, even an obvious
  one the reporter did not mention, it is `critical`.
- `critical`: Major functionality broken or data silently lost, workaround exists
- `degraded`: Works but with noticeable problems
- `minor`: Cosmetic or negligible effect

Feature requests and improvements are `minor` unless existing use is broken. Score fixed tickets as
reported.

**Breadth:**

- `widespread`: The default setup of the package or command
- `common`: A mainstream framework, runtime or module system, or a command used in normal flows
- `uncommon`: Needs a specific option, input value, field type or path
- `edge-case`: Rare conditions or unusual usage

Judge the reported scenario, not the install base: if it needs a specific option or input, it is
`uncommon`.

Score impact and breadth only; whether it is a regression does not affect priority.

**Overall priority:**

| Priority          | Criteria                                                       |
| ----------------- | -------------------------------------------------------------- |
| **P0 — Critical** | Blocker + widespread/common                                    |
| **P1 — High**     | Critical + widespread/common, or blocker + uncommon/edge-case  |
| **P2 — Medium**   | Degraded + widespread/common, or critical + uncommon/edge-case |
| **P3 — Low**      | Minor impact, or degraded + uncommon/edge-case                 |

#### 3d. Verdict

| Verdict        | When to use                                               |
| -------------- | --------------------------------------------------------- |
| **actionable** | Enough info to proceed                                    |
| **needs-info** | Cannot proceed without more information from the reporter |
| **duplicate**  | Already tracked elsewhere — link to the original          |
| **not-a-bug**  | Working as intended, user error, or environment issue     |
| **wont-fix**   | Valid but out of scope or conflicts with design direction |
| **fixed**      | Already resolved: ask the reporter to confirm and close   |

#### 3e. Duplicate search

Search for duplicates on every ticket:

- GitHub:
  `gh issue list --repo storyblok/monoblok --search "<keywords>" --state open --limit 10 --json number,title,labels`
- Linear: check `relations` field from the fetch response

If exact duplicate → mark as **duplicate** with link to original. If related but different → note
the connection.

### Step 4: Present results

#### Summary table

```markdown
## Triage Summary

| Ticket | Title | Type        | Priority | Verdict    | Package | Suggested labels |
| ------ | ----- | ----------- | -------- | ---------- | ------- | ---------------- |
| #368   | ...   | bug         | P1       | actionable | cli     | `pkg: cli`       |
| DX-123 | ...   | improvement | P2       | actionable | vue     | `pkg: vue`       |
```

#### Detailed assessment (one per ticket)

```markdown
### <ticket-id>: <title>

**Source:** GitHub / Linear **Type:** <type> (correct reporter's classification if needed)
**Reproducibility:** <assessment> **Priority:** <P0-P3> — <Critical|High|Medium|Low>

- Impact: <level> (<reason>)
- Breadth: <level> (<reason>)
- Regression: <yes/no> (worked in an earlier release, per the report; evidence beats a label)
- Related: <tickets> **Package:** <package> **Verdict:** <verdict>
- Fix PR: <#number or none> **Labels:** <suggested labels>

**Summary:** <2-3 sentences>

**Suggested next step:** <what to do next>
```

For **needs-info** tickets, include a draft reply asking for the missing information.

## Labels

Suggest only labels that exist (`gh label list --repo storyblok/monoblok`); priority has no label.
Package → label is `pkg: <folder>`, except `capi-client` → `pkg: api-client`, `mapi-client` →
`pkg: management-api-client` and `js-client` → `pkg: storyblok-js-client`. Suggest none if no label
fits (e.g. `schema`).

## Output

Write `claude-output/triage-<identifier>.md`, or `triage-<YYYY-MM-DD-HHMMSS>-batch.md` (UTC) for
several issues, so a later batch never overwrites an earlier one. Every issue gets a `### #<number>`
heading; for P3 the body is the one line below. Start with a "Needs attention" list: P0/P1, any
regression, or P2 with no `OWNER`/`MEMBER`/`COLLABORATOR` comment in the last 14 days
(`gh issue view --json comments` includes `authorAssociation`). Leave out any issue with an open fix
PR or the verdict `fixed`, even a P0/P1 or a regression. Give every issue its scores, one line is
enough for P3 (no summary or next step):
`#123 P3 | minor / edge-case | verdict | pkg | fix PR or none`. Present the summary table, sorted by
priority, then by ticket number from highest to lowest (newest first); in a mixed run, GitHub
tickets come before Linear ones within the same priority. Sort the "Needs attention" list the same
way, and write the detailed sections in table order.

## Rules

- **Read-only.** Never create, update, comment on, or close issues on GitHub or Linear.
- **No code analysis.** Use `/investigate` for deep dives.
- When unsure about type, lean toward **bug**; priority always follows the table.
- If the reporter's version is outdated, the next step is "retest on the latest version", unless the
  changelog or `git log` shows it is already fixed.
