# Specs & Tickets Guide

## When to use what

| Document | Use when |
|----------|----------|
| **Project** | Multiple tickets, cross-cutting concerns, new package or major feature |
| **Ticket** | Single deliverable, 1-3 days of work |

## Principles

- **Only useful information**: if a section adds nothing, remove it. No boilerplate.
- **No redundancy**: specs describe *what to build*, outcome verifies *that it shipped*. Never say the same thing twice.
- **Scale to complexity**: a config tweak needs a paragraph. A new SDK needs full sections with milestones. Match structure to content.
- **DX specs are specs**: command syntax, config formats, file structures, and output examples ARE specifications (the user-facing contract). Internal function names and class hierarchies are NOT.

## Project structure

Every project has three core sections. Add optional sections only when they provide real value.

### Core sections

| Section | Purpose |
|---------|---------|
| **Context** | Why this exists, who asked for it, what pain it solves. Include stakeholders and architectural decisions that shape the project. |
| **Specifications** | What to build: features, constraints, DX contract, non-functional requirements. Structure varies by project type. |
| **Outcome** | What ships and how to verify. AC checkboxes, deliverables list, or per-milestone outcomes. |

### Optional sections

| Section | When to use |
|---------|-------------|
| **Open Questions** | Unresolved decisions that block or shape the work. Place at the TOP, before Context. |
| **Use Cases** | Concrete user-facing scenarios that clarify the spec: command examples, workflows, filtering examples, before/after. Use when the spec alone doesn't convey how the feature feels in practice. |
| **Risks** | Technical risks, migration concerns, known limitations, areas of uncertainty. |
| **Notes** | Architectural decisions, stakeholders, dependencies, things to keep in mind. |
| **Milestones** | Phased delivery with in/out scope per phase. Outcome moves inside each milestone. |
| **Reference** | Prior art, inspiration, community packages, useful links. |
| **Out of scope** | When there's real risk of scope creep. Can also be inline in Specs. |

## Specifications structure

Match the structure to the project type:

**SDK projects** (Angular, React): Use **bold labels** inline: **Features**, **Environments**, **Compatibility**, **Testing**, **DX**. Keep it dense and scannable.

**CLI/infrastructure projects** (Assets, Config): Use ### sub-sections with concrete examples: config formats, command syntax, file structures, filtering options. The spec IS the DX contract.

**Tiered-feature projects** (Android): Use priority levels (C0/C1/C2/C3) when features have clear priority tiers.

**Small projects**: Flat bullet list or flowing prose.

## Outcome format

Choose what fits the project:

- **AC checkboxes**: for feature projects with verifiable user-facing behavior. Each AC describes what a user can do or verify, not implementation details.
- **Deliverables list**: for infrastructure projects (what ships).
- **Per-milestone outcomes**: for staged delivery. Each milestone defines in/out scope and its own outcome.
- **Brief sentence**: for small, well-bounded projects.

## Quality checklist

- [ ] Context is specific, not generic
- [ ] Specs describe the DX contract (what the user sees/does), not internal implementation
- [ ] No section redundancy
- [ ] Outcome is clear: what ships, how to verify
- [ ] Structure matches the project's complexity
- [ ] Open questions are surfaced, not buried

## Workflow

```
Idea → /spec → Review → /plan → /implement → Ship
```

`/spec` handles both project specs and ticket specs. It determines the right format based on scope:
- Multi-day, cross-cutting work → project spec
- Single deliverable, 1-3 days → ticket spec

See `examples/` for real project specs of different shapes.
