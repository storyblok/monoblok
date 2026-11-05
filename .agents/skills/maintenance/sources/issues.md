# Source: GitHub issues

`bash .agents/skills/maintenance/scripts/issues.sh` returns `stale` (90 or more days without human
activity, with the `action` to show) and `active` (issues awaiting triage), across every repo in the
digest. Each item has a `repo` and a `ref` (`#836` in monoblok, `kotlin#20` elsewhere); use the
`ref` as the issue's name everywhere.

## Active issues

1. **Reuse reports.** For each issue, take the newest `claude-output/triage-*.md` report by
   modification time that covers it: it has a `### <ref>` heading or a summary-table row for the
   issue, not just a mention. Reuse it unless the issue's `lastActivity` is later than the report's
   modification time, printed as a comparable UTC timestamp by
   `date -u -r <file> +%Y-%m-%dT%H:%M:%SZ`. Compare timestamps, never dates: a comment can land the
   same day after the report. Label changes are not tracked.
2. **Triage the rest** with the triage skill: inline for up to 3 issues, otherwise in one subagent.
   Pass the issues' `ref`s explicitly. Reading the skill file does not run its `` !`gh ...` ``
   context line or fill in `$ARGUMENTS`; skip the former, the numbers replace the latter.
3. **Take only the per-issue assessment from the reports:** type, priority, verdict, regression,
   package, suggested labels and fix PR (used for PR matching), from the issue's detailed section
   when it disagrees with the summary row. The title comes from `issues.sh`. Never copy a report's
   issue list or its "Needs attention" list: closed issues, new fix PRs and the passing of time make
   them stale.
4. **Rebuild "Needs attention" every run** from the current `active` list with the triage skill's
   rule. Use `lastMaintainerComment` from `issues.sh` for the 14-day check (null means never), and
   one `bash .agents/skills/triage/scripts/linked-prs.sh --repo <repo> <its active numbers>` call
   per repo for open fix PRs (`byIssue`).

## Sections

- **Needs attention now:** the list from step 4, one line per issue: why it is there, plus at most
  one fact from the report that changes what to do (e.g. the reporter offers a PR).
- **Issues (N triaged):** the triage summary table, one row per `active` issue. N is the number of
  rows.

Sort both by priority, then newest first (the order `issues.sh` returns).

- **Stale (N):** every `stale` entry, in the order the script returns (most recent activity first):

```markdown
- [<ref>](url) <title> (<n> days, last activity <date>): close for inactivity | needs a maintainer
  reply
```
