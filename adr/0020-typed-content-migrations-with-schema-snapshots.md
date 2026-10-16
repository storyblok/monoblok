# ADR-0020: Typed Content Migrations with Schema Snapshots

**Status:** Accepted **Date:** 2026-10-16

Supersedes the file format decision in [ADR-0009](0009-schema-push-migration-generation.md).
Breaking change detection inside `schema push` stands.

## Context

ADR-0009 generated per-component `.js` functions for `migrations run` and rejected a schema-level
migration DSL because it needed a new engine. `@storyblok/schema/migrations` now provides that
engine: `defineMigration()` ops typed against the schema, run by `migrations apply` with a journal
and undo. Generated migrations should use it.

Typing a migration against the project's live schema breaks over time. The fields a migration reads
are the ones the schema no longer has, and each later change to the fields it writes turns old,
already applied migrations into type errors.

## Decision

- `schema push` and `migrations generate --schema` write one `defineMigration` file per run, typed
  as `defineMigration<After, Before>`.
- Two generated snapshots sit next to it and are never edited: `.before.ts` from the space's
  components and `.after.ts` from the local schema. Each holds the blocks the migration touches with
  their fields, plus name-only stubs for the blocks those fields allow. The `.before.ts` snapshot
  also stubs every block that can contain a touched block, so `under` can name it, and lists every
  other block in `nameOnlyBlocks`, so `migrations apply` can tell an existing block from a new one.
- `--no-snapshots` types the migration against the schema entry file. `--legacy` keeps the ADR-0009
  `.js` output for `migrations run`.
- Migration ids start with the UTC creation time (`YYYYMMDDHHmmss`), not a sequence number, so
  migrations written on separate branches don't claim the same prefix.
- An op the generator cannot write gets a callback that throws, so `migrations apply` refuses it
  until the author replaces it, instead of applying a no-op.
- The generators live in `@storyblok/schema/codegen` next to the DSL whose source they emit. The
  public surface is `generateSnapshot()` and `generateMigrationSource()`, experimental, with the
  generated text outside semver. The `defineField` serializer that `schema init` shares sits behind
  the internal `@storyblok/schema/internal/codegen` subpath.

## Alternatives Considered

- **Type writes against the live schema** — No `.after.ts` file, but old migrations break `tsc`
  whenever a field they write changes later.
- **One `.snapshot.ts` file holding both sides** — Fewer files, but `migrations apply` discovers
  `.before.ts` snapshots today, and the two sides are generated from different sources.
- **Sequential numeric ids** — Shorter names, but two branches each generating `0003-*` both land,
  and the filename tie-break decides their order.
- **Codegen in the CLI** — The CLI is the only consumer today, but the generators emit
  `@storyblok/schema` DSL source and are tested by compiling it against that package.

## Consequences

- `schema push --migrations && migrations run` no longer migrates content by default.
  `migrations run` exits with an error when the directory holds only content migrations, so such
  scripts fail instead of passing silently.
- A migration's directory holds three files per migration. Snapshots of large spaces grow with the
  number of blocks that can contain a touched block, one line per stub.
- Ops on blocks nested inside a touched block need a migration generated for that block, because a
  stub types its fields as empty.
