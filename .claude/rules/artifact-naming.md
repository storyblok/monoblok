---
paths:
  - "claude-output/**"
---

# Artifact Naming

All generated artifacts go into `claude-output/` (gitignored). Every file follows the pattern:

```
claude-output/<type>-<identifier>-<subtype>.md
```

| Command | Pattern | Example |
|---------|---------|---------|
| `/review-and-qa` | `review-<id>.md` | `review-pr-435.md`, `review-login-flow.md` |
| `/investigate` | `investigate-<id>.md` | `investigate-424.md`, `investigate-WDX-296.md` |
| `/spec` (project) | `spec-<id>.md` | `spec-wdx-310.md`, `spec-asset-optimization.md` |
| `/spec` (ticket) | `ticket-<id>.md` | `ticket-wdx-237.md`, `ticket-add-logout-button.md` |
| PR description | `pr-<id>-summary.md` | `pr-435-summary.md`, `pr-WDX-308-summary.md` |

## Identifier extraction

- PR URL `https://github.com/.../pull/435` or `#435` -> `435`
- Ticket ID `WDX-308` -> `WDX-308`
- Free text "add logout button" -> `add-logout-button` (slugified)

When the same PR/issue produces multiple artifacts (summary + review), the identifier stays the same and the type differentiates them: `pr-435-summary.md`, `review-pr-435.md`.
