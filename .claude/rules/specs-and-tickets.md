---
paths:
  - "claude-output/spec-*"
  - "claude-output/ticket-*"
---

# Specs & Tickets

## Principles
- **Scale to complexity**: small change = paragraph, new SDK = full sections with milestones
- **No redundancy**: specs describe *what*, outcome verifies *done*. Never have both say the same thing.
- **Only useful sections**: skip sections that add no information

## Project Specs
- Core sections: **Context**, **Specifications**, **Outcome** (always present)
- Optional sections: **Open Questions** (at top), **Use Cases**, **Risks**, **Notes**, **Milestones**, **Reference**, **Out of scope**
- DX specs (command syntax, config formats, file structures) ARE specifications
- SDK projects: bold labels inline (**Features**, **Environments**, **Compatibility**, **Testing**, **DX**)
- CLI/infrastructure: sub-sections with concrete examples (config formats, command syntax)

## Ticket Specs
- Single deliverable, 1-3 day effort
- Clear boundaries on what's in and out

See `.claude/skills/spec/` for templates, guide, and examples.
