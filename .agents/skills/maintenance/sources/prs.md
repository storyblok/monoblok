# Source: GitHub PRs

`bash .agents/skills/maintenance/scripts/prs.sh` returns `outside` and `members` across every repo
in the digest; bots are already dropped. Each PR has a `repo` and a `ref` (`#909`, `kotlin#34`). A
maintainer whose org membership is private shows up in `outside`; skip their PRs.

## Matching PRs to issues

For both lists, match each PR's title and package by meaning against all open GitHub issues of its
repo (`gh issue list --repo <repo> --state open --limit 200 --json number,title,url`, fetched once
per repo; `issues.sh` only covers issues awaiting triage) and the Linear issues that are not
completed or canceled. A PR named as the fix PR in a current triage report is a match too. Write
"may solve [#N](url)" or "may solve [DX-N](url)" only for a clear match.

## Outside contributors

The focus, since outside contributions are the ones we miss. One table row per `outside` PR, newest
first, with the script's `size`, `ci`, `review` and `notes`. `ci` is `fail`, `action required` (a
fork PR waiting for workflow approval), `not run` (a workflow that never ran a job), `pending`,
`pass` or `none`. Add the issue match and, unless the PR is a draft, "review with review-and-qa" to
the Notes column. Do not review.

## Members

Skip the table; members remind each other. `members` holds non-draft PRs without a closing issue
reference or DX id that are not yet approved. One bullet each with the issue match, or "no issue
found, link one", and "changes requested" when `review` is `CHANGES_REQUESTED`.

## Sections

```markdown
### PRs from outside contributors (N)

| #   | Title | Author | Size | CI  | Review | Notes |
| --- | ----- | ------ | ---- | --- | ------ | ----- |

### Member PRs without a linked issue (N, approved ones skipped)

- [<ref>](pr-url) <title>: may solve [<ref>](issue-url) | no issue found, link one[, changes
  requested]
```
