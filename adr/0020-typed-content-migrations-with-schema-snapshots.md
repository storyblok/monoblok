# ADR-0020: Typed Content Migrations with Schema Snapshots

**Status:** Accepted **Date:** 2026-10-16

Supersedes the file format decision in [ADR-0009](0009-schema-push-migration-generation.md).
Breaking change detection inside `schema push` stands.

## Context

ADR-0009 generated per-component `.js` functions for `migrations run` and rejected a schema-level
migration DSL because it needed a new engine. `@storyblok/schema/migrations` now provides that
engine: `defineMigration()` ops typed against the schema, run by `migrations apply` with a journal
and undo. Generated migrations should use it.

The fields a migration reads are often the ones the project's schema no longer has, so typing reads
against the live schema checks nothing.

## Decision

- `schema push` and `migrations generate --schema` write one `defineMigration` file per run, typed
  as `defineMigration<Schema, Before>`: writes against the project's live `Schema`, reads against a
  generated `.before.ts` snapshot of the space's components that is never edited.
- The snapshot holds the blocks the migration reads with their fields, plus name-only stubs for the
  blocks those fields allow and for every block that can contain a read block through a `bloks`
  field or an allow list, so `under` can name it. `nameOnlyBlocks` lists every other block of the
  space, so `migrations apply` can tell an existing block from a new one.
- `--no-before` skips the snapshot. `--legacy` keeps the ADR-0009 `.js` output for `migrations run`.
- Migration ids start with the UTC creation time (`YYYYMMDDHHmmss`), not a sequence number, so
  migrations written on separate branches don't claim the same prefix.
- An op the generator cannot write gets a callback that throws, so `migrations apply` refuses it
  until the author replaces it, instead of applying a no-op. A removal that matches a new required
  field of the same type gets a TODO naming the possible rename.
- The generators live in `@storyblok/schema/codegen` next to the DSL whose source they emit. The
  public surface is `generateSnapshot()` and `generateMigrationSource()`, experimental, with the
  generated text outside semver. The `defineField` serializer that `schema init` shares sits behind
  the internal `@storyblok/schema/internal/codegen` subpath.

## Alternatives Considered

- **An `.after.ts` snapshot for writes** — Typing writes against a frozen snapshot keeps old
  migrations compiling after later schema changes, but adds a third file per migration and a runtime
  load of the schema entry. Kysely (`Kysely<any>` in migrations) and Rails (no app models in
  migrations) solve the same drift by keeping migrations independent of current code; retiring a
  migration once applied does the same here.
- **No types** — Contentful and Sanity type migration callbacks loosely or not at all. Typed reads
  catch misspelled and removed field names, which is most of the value.
- **Sequential numeric ids** — Shorter names, but two branches each generating `0003-*` both land,
  and the filename tie-break decides their order.
- **Codegen in the CLI** — The CLI is the only consumer today, but the generators emit
  `@storyblok/schema` DSL source and are tested by compiling it against that package.

## Consequences

- A later rename or removal of a field a migration writes is a type error in that migration. Once
  every space has applied it, the migration is deleted or excluded from type checking.
- `migrations apply` reruns every migration, so ops must be idempotent. `Before` describes content
  before the first run; a callback checks a value's shape before converting it. Typing reads as
  "before or after" is a possible follow-up.
- `schema push --migrations && migrations run` no longer migrates content by default.
  `migrations run` exits with an error when the directory holds only content migrations, so such
  scripts fail instead of passing silently.
- Ops on blocks nested inside a read block need a migration generated for that block, because a stub
  types its fields as empty.
- An unrestricted `richtext` field doesn't make its block a container. Most blocks of a space have
  one, and counting them grew the median snapshot of a 177-block space from 128 to 407 lines. An
  `under` naming a block that holds the read block only through richtext is a type error, though
  `migrations apply` accepts it.
