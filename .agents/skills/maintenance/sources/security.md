# Source: security alerts

`bash .agents/skills/maintenance/scripts/dependabot.sh` returns the open Dependabot alerts of every
repo in the digest, grouped by package, with `counts` per severity. A repo with an `error` has
alerts disabled or unreadable: say so in one line and move on.

Alerts are security-sensitive. The digest is a local file, so details are fine there, but never copy
alert details into commits, PR text, issue comments or public channels.

## What to list

Most alerts come from transitive dependencies in the lockfile, so list only what needs a decision:

- **New:** groups whose `lastSeen` is within the window, any severity.
- **Critical:** every `critical` group.
- **Shipped:** groups with a non-empty `packages`: a runtime dependency of a published package, so
  consumers get it too.

A group in several lists appears once, in the first. For each, give the severity, the package,
`packages` when set, and `fixedIn`. Match each against the open PRs from `prs.sh` and the Dependabot
or Renovate PRs in the repo (`gh pr list --repo <repo> --search "<package>"`) and add "fix PR
[<ref>](url)" when one exists. Count everything else only.

## Section

```markdown
### Security (N to look at)

- <short>: <n> critical, <n> high, <n> medium, <n> low packages; <short>, <short>: none
- New: <severity> `<package>` (<packages>), fixed in <version> ([alerts](url))
- Critical: `<package>`, fixed in <version> ([alerts](url)), fix PR [<ref>](url)
- Shipped: <severity> `<package>` (<packages>), fixed in <version>
```

N is the number of New, Critical and Shipped bullets. Link `urls[0]` as "alerts". When `fixedIn` has
several versions, give the one for the major in use if it is obvious, otherwise the highest.
