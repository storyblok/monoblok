# ADR-0020: Typed Content Migrations with Schema Snapshots

**Status:** Accepted **Date:** 2026-10-16

Supersedes the file format decision in [ADR-0009](0009-schema-push-migration-generation.md) for
`--typed` pushes. Breaking change detection inside `schema push` stands.

## Context

ADR-0009 generated per-component `.js` functions for `migrations run` and rejected a schema-level
migration DSL because it needed a new engine. `@storyblok/schema/migrations` now provides that
engine: `defineMigration()` ops typed against the schema, run by `migrations apply` with a journal
and undo. Generated migrations should be able to use it.

The fields a migration reads are often the ones the project's schema no longer has, so typing reads
against the live schema checks nothing.

`migrations apply` reruns every migration on every run, and its journal stays on the machine that
ran it, so no run can tell which migrations a space has already received.

## Decision

- `schema push --typed` and `migrations generate --schema` write one `defineMigration` file per run,
  typed as `defineMigration<Schema, Before>`: writes against the project's live `Schema`, reads
  against a generated `.before.ts` snapshot of the space's components that is never edited. Without
  these flags, both commands keep writing ADR-0009's `.js` files for `migrations run`.
- The snapshot holds the blocks the migration reads with their fields, plus name-only stubs for the
  blocks those fields allow and for every block that can contain a read block through a `bloks`
  field or an allow list, so `under` can name it. `nameOnlyBlocks` lists every other block of the
  space, so `migrations apply` can tell an existing block from a new one. `--no-before` skips it.
- A snapshot's `schema`, `Before`, and `nameOnlyBlocks` exports are a stable contract, and
  `snapshotFormat` versions it.
- Before it applies a migration, `migrations apply` compares each op with the space's components. It
  skips and reports an op that writes a field the block no longer has, or removes a field the block
  has again.
- Migration ids start with the UTC creation time (`YYYYMMDDHHmmss`), not a sequence number. When an
  existing id sorts at or after that time, the new id is one second past it.
- An op the generator cannot write gets a callback that throws, so `migrations apply` refuses it
  until the author replaces it, instead of applying a no-op. That includes the default of a newly
  required field other than a boolean, since only `false` is a value every required field of its
  type accepts. A fill of a newly required string or number field also counts `""` as missing. Fills
  are an `addField` and an `alterField`, not an `alterBlock`, so the apply check sees the field they
  write.
- A removed field gets a TODO naming every unpaired added field of the same type as a possible
  rename target, whether or not the addition is required.
- `schema push` writes the migration before it pushes. When the push fails, it reads the space
  again, keeps the ops for the blocks that were updated, and removes the rest.
- The generators live in `@storyblok/schema/codegen` next to the DSL whose source they emit. The
  public surface is `generateSnapshot()` and `generateMigrationSource()`, experimental, with the
  generated text outside semver. The `defineField` serializer, the coercion table, and
  `nextMigrationId()` the CLI shares sit behind `@storyblok/schema/internal/codegen`, which is
  undocumented but covered by semver. That includes `formatValue()`'s output, because the CLI's
  schema diff compares values by it.

## Rationale

- **Opt-in flags.** The published CLI writes `.js` files from `schema push`, and scripts chain
  `schema push && migrations run`. Flipping the default in a minor release would break them, and the
  typed format doesn't justify a major release on its own. `migrations generate` already opts in
  through `--schema`, so `--typed` keeps the two commands consistent.
- **Skipping superseded ops.** Each generated op is idempotent on its own, but a rerun of an older
  migration is not idempotent once a later migration changed the same field. Push 1 adds `noindex`,
  push 2 renames it to `hide`. Every later run would add `noindex` back and then refuse the rename,
  because `hide` already holds a value. The space's components are the one record of the schema
  every machine shares, so they decide which ops are stale. Right after a push, they match every
  migration, so nothing is skipped.
- **Semver for the internal subpath.** ADR-0014 publishes the CLI's dependency on
  `@storyblok/schema` as a caret range and forbids bundling it, so a CLI already installed runs
  against later schema releases. Treating `internal/codegen` as semver-covered keeps that safe
  without an exception to ADR-0014.
- **Stable snapshot exports.** Snapshots are committed and loaded by later CLI releases.
  `snapshotFormat` lets a later reader tell old snapshots from new ones.
- **Keeping ops for blocks that were pushed.** The push updates blocks independently. A block that
  was updated no longer differs from the local schema, so the next push can't regenerate its ops.
  Writing before the push keeps the migration if the process stops after it.
- **Valid timestamps after a bump.** Incrementing the number would produce second `60`. Under
  rerun-all, a migration merged late with an older timestamp still runs before newer ones on every
  run, which is harmless only because the ops are idempotent and stale ops are skipped.

## Alternatives Considered

- **Typed output by default** — Simpler, but breaks `schema push && migrations run` scripts in a
  minor release.
- **Skipping migrations the journal records** — The journal stays on the machine that ran it, so
  other machines and CI would still rerun every migration.
- **Guards in the generated code** — A migration can't know about schema changes made after it was
  written.
- **An exact `@storyblok/schema` pin in the CLI, or a private package bundled into both** — Either
  breaks with ADR-0014, and the bundled package also duplicates the serializer in two published
  packages.
- **Writing the migration after the push** — Avoids the cleanup on failure, but a process that stops
  between the push and the write loses the migration for good.
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
  every space has applied it, the migration is deleted or excluded from type checking. Nothing
  records when that is; a shared record of applied migrations is a possible follow-up.
- A migration applied before its schema is pushed has its ops on new fields skipped.
- Ops must still be idempotent. `Before` describes content before the first run; a callback checks a
  value's shape before converting it. Typing reads as "before or after" is a possible follow-up.
- `alterBlock` callbacks aren't checked for staleness, because the fields they touch aren't
  declared.
- An op on a field a later push renamed or removed is skipped, even in stories that still hold the
  field, so each migration is applied before the next schema change is pushed.
- Snapshots carry a `snapshotFormat`, and `migrations apply` refuses a format newer than it reads.
- `migrations run` exits with an error when the directory holds only content migrations, so a script
  that runs it after `schema push --typed` fails instead of passing silently.
- Ops on blocks nested inside a read block need a migration generated for that block, because a stub
  types its fields as empty.
- An unrestricted `richtext` field doesn't make its block a container. Most blocks of a space have
  one, and counting them grew the median snapshot of a 177-block space from 128 to 407 lines. An
  `under` naming a block that holds the read block only through a `richtext` field is a type error,
  though `migrations apply` accepts it.
- Changing `internal/codegen` incompatibly is a breaking change of `@storyblok/schema`: a minor
  release while it is on 0.x, since the CLI's caret range then admits only patches.
