# ADR-0003: Dedicated `schema` Command for Code-Driven Workflows

**Status:** Accepted  
**Date:** 2026-04-10

## Context

The CLI already provides `storyblok components` and `storyblok datasources` commands for syncing Storyblok entities. These commands operate on JSON export files and follow a simple add/overwrite model: push a file, create or replace the matching remote entity.

A separate `@storyblok/schema` package introduced a code-first way to define components, folders, and datasources in TypeScript using `defineBlock()`, `defineField()`, etc. This enables a fully code-driven workflow where the schema lives in the repository and is the single source of truth.

Supporting this workflow requires more than a different input format. It requires:

- **Unified entity management** — push components, folders, and datasources together in a single operation (folders must be upserted before components that reference them).
- **Diffing** — compare local definitions against the remote space and show what will change before applying anything.
- **Stale entity detection and deletion** — identify remote entities not present in the local schema and optionally delete them. The existing commands are strictly additive; they have no concept of stale entities.
- **Changeset tracking** — save a record of the pre-push remote state and the applied changes to support future rollback and migration generation.

These are workflow-level differences, not just a format variation.

## Decision

Introduce a dedicated `storyblok schema` command alongside the existing `components` and `datasources` commands.

The `schema` command targets users who want a fully code-driven approach: the TypeScript schema files in their repository are the authoritative definition of the space structure, and the CLI enforces that state. The existing commands remain for teams that manage schemas through the Storyblok UI or work with JSON exports in CI pipelines.

## Alternatives Considered

- **`--format ts` flag on existing commands** — Adding a TypeScript input format to `components push` and `datasources push` would address the format difference but not the workflow differences. Diffing, unified multi-entity push, and delete semantics do not fit the current add/overwrite model without significant redesign of those commands. The result would be two commands with deeply divergent behavior hidden behind a flag.
- **Separate CLI** — A dedicated `storyblok-schema` (or similar) CLI would give the code-driven toolchain full independence. This is not dismissed as a future option, but shipping two Storyblok CLIs at this stage would fragment the user experience without sufficient justification. If the code-driven workflow grows into a substantially different product surface, extracting it into its own CLI can be reconsidered.

## Consequences

- Users have a clear split: `schema` for code-driven workflows, `components`/`datasources` for JSON-based or UI-driven workflows.
- The existing commands are not deprecated and require no changes.
- If `schema` eventually subsumes the use cases of the existing commands, the older commands may be deprecated at that point — but there is no active plan to do so.
- The `schema` command may in the future be extracted into a separate CLI. The current implementation keeps this path open by not creating deep coupling to CLI-internal infrastructure.
