# ADR-0004: Migration Generation Integrated into Schema Push

**Status:** Accepted
**Date:** 2026-04-10

## Context

The `schema push` command detects field-level changes between local TypeScript definitions and the remote Storyblok space. Some of these changes — field renames, removals, type changes — are breaking: editors see fields disappear or appear empty, and content appears "out of schema" until a content migration is run.

The CLI already has a `migrations` subsystem (`migrations generate`, `migrations run`, `migrations rollback`) that operates on story content. However, `migrations generate` produces only a blank template. There is no connection between schema changes and migration authoring.

Users who push breaking schema changes must currently: notice which fields changed, manually create migration files, write the transformation logic, and run them. This is error-prone and easy to skip.

## Decision

Integrate breaking change detection and migration file generation directly into the `schema push` flow.

After computing the diff and before executing the push, `schema push` analyzes field-level changes, classifies breaking patterns, and offers to generate ready-to-run migration files in the format expected by `storyblok migrations run`.

Push never blocks on breaking changes. Storyblok preserves content under old field keys even when the schema changes — no data is lost, content only appears "out of schema" to editors. Pushing first and migrating later is safe. The migration prompt is a convenience that surfaces at the moment the user is already examining the diff, not a safety gate.

### Flags

- `--migrations` auto-generates without prompting (CI/automation).
- `--no-migrations` skips detection entirely.
- Default is interactive.

### Rename detection

Field renames are detected heuristically (matching removed + added fields by type and name similarity) and confirmed interactively by the user before generating code.

## Alternatives Considered

- **Separate `schema migrate` command** — A dedicated command that reads changesets and generates migration files. Cleaner separation, but adds a step the user must remember. The value of this feature is surfacing at the right moment (during push), not being a separate workflow.
- **Push blocks on breaking changes** — Refuse to push until migrations are run. Considered too aggressive given Storyblok's resilient content model — no data is lost, only editor UX is temporarily degraded. Blocking would frustrate users in development/staging workflows where content integrity is less critical.
- **Schema-level migration DSL** — A new migration format tied to schema changes rather than content transformations. Would require a new execution engine. The existing `migrations run` infrastructure already handles content transformation well; generating files in its format avoids new infrastructure.

## Consequences

- `schema push` gains an optional post-diff step that analyzes field-level changes and generates migration files.
- Generated migration files use the existing format and are run with the existing `storyblok migrations run` command. No new execution infrastructure.
- The existing `migrations generate` command remains for cases where users want a blank template (e.g., complex multi-component migrations).
- The `--migrations` / `--no-migrations` flags make the behavior deterministic for CI pipelines.
