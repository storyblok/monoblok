# Source: watched repos

Low-traffic repos (`watch: true` in `repos.json` or `extraRepos`) get a short overview of everything
open, so activity there is visible even when the other sections skip it (drafts, approved member
PRs, PRs with a linked issue).

`bash .agents/skills/maintenance/scripts/watch.sh` returns one entry per watched repo with its open
`issues`, its open human `prs` and a `botPrs` count. Their issues and PRs also go through the issue
and PR sources as usual; this section only summarizes.

## Section

One bullet per watched repo, nothing else. Name the newest items with their age and author, and mark
drafts and the review state when it is `APPROVED` or `CHANGES_REQUESTED`. Say "nothing open" for an
empty repo.

```markdown
### Watched repos

- <short>: nothing open
- <short>: issue [<ref>](url) (<age>); PRs [<ref>](url) (draft), [<ref>](url) (approved) by
  <author>, <n> more; <n> bot PRs
```
