# ADR-0029: Typed Content Migrations with Schema Snapshots

**Status:** Accepted **Date:** 2026-10-16

Supersedes the file format decision in [ADR-0009](0009-schema-push-migration-generation.md) for
`--typed` pushes. Breaking change detection inside `schema push` stands. Content migrations run
through `migrations run` and `migrations rollback`
([ADR-0028](0028-one-migrations-run-and-rollback-for-both-formats.md)).

## Context

ADR-0009 generated per-component `.js` functions for `migrations run` and rejected a schema-level
migration DSL because it needed a new engine. `@storyblok/schema` now provides that engine:
`defineMigration()` ops typed against the schema, run by `migrations run` with a journal and
rollback. Generated migrations should be able to use it.

The fields a migration reads are often the ones the project's schema no longer has, so typing reads
against the live schema checks nothing.

`migrations run` reruns every migration on every run. Its journal stays on the machine that ran it,
and the space has no place to keep a record of applied migrations, so no run can tell which
migrations a space has already received.

## Decision

- `schema push --typed` and `migrations generate --schema` write one `defineMigration` file per
  invocation, typed as `defineMigration<Schema, Before>`: writes against the project's live
  `Schema`, reads against a generated `.before.ts` snapshot of the space's components that is never
  edited. Without these flags, both commands keep writing ADR-0009's `.js` files for
  `migrations run`.
- The snapshot holds the blocks the migration reads with their fields, plus name-only stubs for the
  blocks those fields allow and for every block that can contain a read block through a `bloks`
  field or an allow list, so `under` can name it. `nameOnlyBlocks` lists every other block of the
  space, so `migrations run` can tell an existing block from a new one. `--no-before` skips the
  snapshot.
- A snapshot's `schema`, `Before`, and `nameOnlyBlocks` exports are a stable contract.
  `snapshotFormat` versions it, and `migrations run` refuses a snapshot without a valid format or
  with one newer than it reads.
- Before it applies a migration, `migrations run` checks each op against the space's components, as
  the block holds them right after that op. It skips and reports an op that creates a field the
  block no longer has, removes a field the block has again, or writes a value the field's type no
  longer stores, and a `renameBlock` while the space holds a block by the old name. The check
  repeats until no further op is skipped. A migration whose ops are all skipped after a complete run
  is reported as superseded.
- A confirmed block rename updates the block with the Management API's content rename, so the space
  renames the block wherever it's used. The push waits until no story uses the old name, and
  generated migrations hold no `renameBlock`. When that count stops dropping for a minute, the push
  continues and warns, pointing to a `renameBlock` migration for the remaining stories. It stops
  after 10 minutes.
- A migration stays pending until a run covers every story it matches. A run scoped with
  `--starts-with` or `--query`, or one that left stories unread, refused, or unwritten, is recorded
  as partial.
- Migration ids start with the UTC creation time (`YYYYMMDDHHmmss`), not a sequence number. When an
  existing id sorts at or after that time, the new id is one second past it.
- An op the generator cannot write gets a callback that throws, so `migrations run` refuses it until
  the author replaces it, instead of applying a no-op. That includes the default of a newly required
  field other than a boolean, since only `false` is a value every required field of its type
  accepts. A fill of a newly required string or number field also counts `""` as missing. Fills are
  an `addField` and an `alterField`, not an `alterBlock`, so the check in `migrations run` sees the
  field they write.
- A removed field gets a TODO naming every unpaired added field of the same type as a possible
  rename target, whether or not the addition is required.
- `schema push` writes the migration before it pushes. When the push fails, it reads the space
  again, keeps the ops for the blocks that were updated, and removes the rest.
- The generators, the `defineField` serializer, the coercion table, and `nextMigrationId()` live in
  `@storyblok/schema` behind `@storyblok/schema/internal/codegen`, next to the DSL whose source they
  emit. The subpath is undocumented, and its functions are covered by semver, including
  `formatValue()`'s output, because the CLI's schema diff compares values by it. The text of
  generated source is not.
- Revisit making `--typed` the default at the next major of the CLI.

## Rationale

- **Opt-in flags.** The published CLI writes `.js` files from `schema push`, and scripts chain
  `schema push && migrations run`. Flipping the default in a minor release would break them, and the
  typed format doesn't justify a major release on its own. `migrations generate` already opts in
  through `--schema`, so `--typed` keeps the two commands consistent.
- **Skipping superseded ops.** Each generated op is idempotent on its own, but a rerun of an older
  migration is not idempotent once a later migration changed the same field. Push 1 adds `noindex`,
  push 2 renames it to `hide`. Every later run would add `noindex` back and then refuse the rename,
  because `hide` already holds a value. The space's components are the one record of the schema
  every machine shares, so they decide which ops are stale. Right after a push, they match the
  migration it wrote, so none of its ops is skipped.
- **Block renames through the space.** The space's content rename covers what a `renameBlock` op
  can't reach: published versions, experiment variants, the content types of folders, other blocks'
  allow and deny lists, and presets. It also leaves no gap between the push and `migrations run` in
  which stories name a block the space no longer holds.
- **Stall detection for block renames.** The space doesn't report a failed background rename, so a
  count that stops dropping is the only sign of one. Waiting until the timeout would hold up a push
  for 10 minutes on every failed rename.
- **Partial runs stay pending.** A rerun after a later push skips the migration's stale ops, so the
  stories a partial run left out could never be migrated once the next push lands.
- **Semver for the internal subpath.** ADR-0014 publishes the CLI's dependency on
  `@storyblok/schema` as a caret range and forbids bundling it, so a CLI already installed runs
  against later schema releases. Treating `internal/codegen` as semver-covered keeps that safe
  without an exception to ADR-0014. No other package needs the generators, so they get no public
  subpath.
- **Stable snapshot exports.** Snapshots are committed and loaded by later CLI releases.
  `snapshotFormat` lets a later reader tell old snapshots from new ones.
- **Keeping ops for blocks that were pushed.** The push updates blocks independently. A block that
  was updated no longer differs from the local schema, so the next push can't regenerate its ops.
  Writing before the push keeps the migration if the process stops after it.
- **Timestamp ids.** Incrementing the number would produce second `60`. Because every run reruns
  every migration, a migration merged late with an older timestamp still runs before newer ones,
  which is harmless only because the ops are idempotent and stale ops are skipped.

## Alternatives Considered

- **Typed output by default** — Simpler, but breaks `schema push && migrations run` scripts in a
  minor release.
- **Skipping migrations the journal records** — The journal stays on the machine that ran it, so
  other machines and CI would still rerun every migration.
- **A record of applied migrations in the space** — Would let every machine skip applied migrations,
  but the space has no place to keep one.
- **Guards in the generated code** — A migration can't know about schema changes made after it was
  written.
- **`renameBlock` in the generated migration** — Reaches only the story versions a run writes, and
  needs the CLI to update folders and other blocks itself.
- **An exact `@storyblok/schema` pin in the CLI, or a private package bundled into both** — Either
  breaks with ADR-0014, and the bundled package also duplicates the serializer in two published
  packages.
- **A public, experimental `@storyblok/schema/codegen` subpath** — No consumer besides the CLI, and
  a second subpath to keep apart from `internal/codegen`.
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
  records when that is.
- A migration applied before its schema is pushed has its ops on new fields skipped.
- Ops must still be idempotent. `Before` describes content before the first run; a callback checks a
  value's shape before converting it. Typing reads as "before or after" is a possible follow-up.
- `alterBlock` callbacks aren't checked for staleness, because the fields they touch aren't
  declared.
- An op that creates a field a later push renamed or removed is skipped, even in stories that still
  hold the source field, so each migration is applied before the next schema change is pushed. Ops
  that only change an existing value (`alterField`, `coerceField`, `reorderField`) are not skipped
  for a missing field: they leave blocks without it alone, and stories that still hold it reach the
  later migration in the shape it expects.
- Some spaces delete a removed field's content from story drafts shortly after the push that removes
  the field. There, a `--typed` push loses the source of a `renameField`, `fieldsToBlock`,
  `mergeFields`, or `splitField` before `migrations run` reads it. The CLI can't detect whether a
  space does this.
- A story whose published version uses a renamed block but whose draft doesn't keeps the old name in
  its published version.
- Ops on blocks nested inside a read block need a migration generated for that block, because a stub
  types its fields as empty.
- An unrestricted `richtext` field doesn't make its block a container. Most blocks of a space have
  one, and counting them grew the median snapshot of a 177-block space from 128 to 407 lines. An
  `under` naming a block that holds the read block only through a `richtext` field is a type error,
  though `migrations run` accepts it.
- Changing `internal/codegen` incompatibly is a breaking change of `@storyblok/schema`: a minor
  release while it is on 0.x, since the CLI's caret range then admits only patches.
