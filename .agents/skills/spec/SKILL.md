---
name: spec
description: Generate a project spec or ticket spec. Use when asked to spec, define, design, or write a ticket for a project or task.
model: sonnet
disable-model-invocation: true
effort: high
---

# Spec

Generate a spec for: $ARGUMENTS

## Output instructions

**IMPORTANT:** Write the spec output to a markdown file, NOT to the terminal.

1. Extract an identifier from the arguments:
   - For ticket IDs like `WDX-237` -> use `wdx-237`
   - For descriptions -> slugify the first few words (e.g., "CLI login flow" -> `cli-login-flow`)

2. Create the output directory if it doesn't exist:
   ```bash
   mkdir -p claude-output
   ```

3. Determine the spec type based on scope:
   - **Project spec** (multi-day, cross-cutting, new package/major feature): write to `claude-output/spec-<identifier>.md`
   - **Ticket spec** (single deliverable, 1-3 days): write to `claude-output/ticket-<identifier>.md`

4. After writing, confirm the output path to the user.

---

## Context

Read the relevant context files based on the project scope:

- `.claude/context/cli-architecture.md` - When speccing CLI commands or features
- `.claude/context/storyrails.md` - When speccing features that involve API interactions. Explore the storyrails repo for endpoint contracts
- `.claude/context/docs-platform.md` - When speccing documentation changes
- `.claude/context/storyfront.md` - When speccing visual editor or bridge protocol features
- `.claude/context/storyblok-kotlin.md` - When speccing Kotlin/Android SDK features
- `.claude/context/storyblok-swift.md` - When speccing Swift/Apple SDK features

## Instructions

1. **Understand the problem** - What pain point does this solve? Who asked for it?
2. **Determine scope** - Is this a project (multi-day, cross-cutting) or a ticket (single deliverable, 1-3 days)?
3. **Research** - Read relevant code and context files, check storyrails for API contracts, look at existing patterns
4. **Write the spec** - Use the appropriate template

## What to include vs. leave to the developer

Specs define the **user-facing contract**, not internal architecture.

**INCLUDE:**
- Capabilities that must exist
- Target versions and platforms
- DX principles and patterns to follow
- Non-functional requirements (performance, reliability, coverage)
- Architectural constraints (e.g., "must compose on top of @storyblok/capi-client")
- Command syntax, config formats, file structures, output examples (these ARE the DX spec)

**DO NOT INCLUDE:**
- Internal function, method, or class names
- Internal file/folder structure or module organization
- Implementation approach (algorithms, data structures, internal flow)

## Templates

### Project specs

Use `templates/project.md` as the base. Adapt structure to the project:

- **Open questions at the top** when there are unresolved decisions
- **Specs sub-sectioned by area** for large projects (General, Features, Non-functional)
- **Specs with bold labels** for medium SDK projects (Features, Environments, DX)
- **Specs by command with examples** for CLI projects
- **Milestones** for phased delivery
- **AC checkboxes** when there are concrete verifiable endpoints
- **Deliverables list** when the outcome is "what ships"

### Ticket specs

Use `templates/ticket.md` as the base. Adapt to complexity:

- Simple bugfix: Context + What to do + AC (skip Notes if none)
- Feature with ambiguity: add Out of scope, Proposed change, Notes

### Reference

See `guide.md` for principles and `examples/` for real project specs of different shapes and sizes.

## Rules
- Scale structure to complexity
- No redundancy between sections
- Surface open questions prominently
- For CLI projects: include command syntax, file format examples, and note usage of logger/UI/config systems
- Keep ticket scope small (1-3 day effort max)
- All acceptance criteria must be checkboxes
- **Never create GitHub issues** - Write to `claude-output/` as markdown for Linear
