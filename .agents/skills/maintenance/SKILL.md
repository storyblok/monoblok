---
name: maintenance
description:
  Use when asked for the daily maintenance digest of issues awaiting triage, new PRs, and Slack
  threads that need a maintainer
model: sonnet
---

# Daily Maintenance Digest

Gather what needs a maintainer's attention into one digest for the dev on triage rotation. Takes no
arguments.

Read-only: never comment, label, assign, or post anywhere. Output is a local file plus a terminal
summary. Triage logic lives in the triage skill (`.agents/skills/triage/SKILL.md`); this skill only
collects sources and hands them over. Subagents: read and follow that skill, there is no runnable
command.

## Config

Slack identifiers are internal, so they live in the git-ignored
`.agents/skills/maintenance/config.local.json`, never in this public repo. Its shape is
`config.example.json`. If the file is missing, ask the user once for the four values, write the
file, and continue. Do this in the main session before starting subagents; subagents read the file
and never ask. Never print the values into commits, PR text or the committed skill.

## Shared inputs

Scripts in `.agents/skills/maintenance/scripts/` do the deterministic filtering; run them instead of
re-deriving their logic.

- **Window:** `bash .agents/skills/maintenance/scripts/window.sh` prints 00:00 UTC of the previous
  weekday (Friday on a Monday); `--epoch` prints it as Unix seconds. "New" in every source means
  created within the window.
- **Linear:** GitHub issues sync to Linear with the same title. Fetch the team's issues once
  (`mcp__claude_ai_Linear__list_issues`, team `DX`, fields `title`, `url` and `status`,
  `limit: 250`, follow `cursor` if returned) and reuse that list in every source. Link a GitHub
  issue to the Linear issue with the exact same title.

## Sources

Read each source file in `.agents/skills/maintenance/sources/` and follow it. Each one says how to
collect its items and which digest sections it fills. To add a source, add a file there and list it
here and in the section list under Output.

1. `issues.md`: GitHub issues awaiting triage, triaged with the triage skill, and stale issues.
2. `prs.md`: open PRs from outside contributors, and member PRs without a linked issue.
3. `slack.md`: new posts, mentions of the DX team, and stale threads in the support channel.

## Output

Write `claude-output/maintenance-<YYYY-MM-DD-HHMMSS>.md` (UTC, to keep parallel runs apart) and
print only the digest, not triage's own summary. Omit empty sections, Slack included.

Render every issue, Linear and PR reference, including those copied from the triage report and in
the terminal summary, as a markdown link so it is clickable:
`[#836](https://github.com/storyblok/monoblok/issues/836)` for issues, `.../pull/<n>` for PRs. Use
the `url` field when `gh` returns one. Show the Linear link next to every GitHub issue link, e.g.
`[#836](gh-url) [DX-611](linear-url)`; omit it silently if there is no match. Write Slack permalinks
as links too.

Sections, in this order, with the source file that defines each:

1. Needs attention now (`issues.md`)
2. Issues (N triaged) (`issues.md`)
3. PRs from outside contributors (N) (`prs.md`)
4. Member PRs without a linked issue (N, approved ones skipped) (`prs.md`)
5. Slack (N new) (`slack.md`)
6. Stale Slack threads (N) (`slack.md`)
7. Stale (N) (`issues.md`)

Start the file with `## Maintenance digest <YYYY-MM-DD>` and give each section a `###` heading.
