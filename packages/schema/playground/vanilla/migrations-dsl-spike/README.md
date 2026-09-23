# `defineMigration` DSL: feasibility spike

**Status: spike. Prototype quality, not a shipped API.** Lives in the schema playground on purpose;
placement is an open question.

Probes the proposed content-migrations DSL that ties `@storyblok/migrations` to `@storyblok/schema`.
A migration is a list of ops — plain objects built by imported factories — not a script and not a
chain:

```ts
import type { Schema } from "../schema";

export default defineMigration<Schema>([
  renameField({ block: "article", field: "author", to: "byline" }),
]);
```

## Ops are data

`renameField({…})` returns `{ kind: "renameField", block, field, to }`. Nothing runs at module load,
which is what buys three things at once: `--dry-run` prints the plan without a network call, a key
op inverts from the op alone (`src/derive-inverse.ts`), and anyone can add an op by writing a
function that returns one.

The spike's first question is whether the typing survives the move off the builder. A factory is
called in `defineMigration`'s argument list, where the schema appears in no argument, so every type
parameter has to reach it through the contextual return type. It does:
`test/define-migration.test-d.ts` pins a typo in a field name, a field borrowed from another block,
an unknown block, and a rename target the post-migration schema does not declare, all as compile
errors from a bare `defineMigration<After, Before>([…])`. The cost is a phantom property on every op
type — the type parameters must occur in the return type for the channel to exist at all.

### Measured cost: ops compose only where a contextual type reaches them

This is the one place the op list charges for what it buys, and the number is exact: an op has to be
written where `defineMigration`'s parameter type can reach it. Hoist the same correct op into a
variable and it stops compiling.

```ts
const op = removeField({ block: "article", field: "author" });
defineMigration<After, Before>([op]);
// TS2322: RemoveFieldOp<SchemaShape, SchemaShape> is not assignable to
//         RemoveFieldOp<After, Before>
```

With no contextual type the parameters infer to their constraint, `SchemaShape`, and the phantom
brand then blocks the assignment. Two consequences, and the second is the worse one. The error talks
about the brand, never about the name that is actually wrong, and it points at the array element
rather than at the call. And in that position the factory call is unchecked on the way in:
`removeField({ block: "nope", field: "authr" })` raises nothing on its own line, because
`SourceFieldName<SchemaShape, SchemaShape, …>` degrades to `string`.

What still works, all verified: a direct literal;
`BLOCKS.map((block) => removeField({ block, field: "gtm_id" }))`, because the arrow's return
position is contextual; an inline ternary; `satisfies MigrationOps<After, Before>`; and a helper
whose return type is written out as `MigrationOpOf<After, Before>`. So ops compose through callbacks
but not through variables, and the workaround is the explicit annotation the DSL exists to avoid.

Nothing here is fixable inside the op-list shape: it follows from a top-level factory having no
other channel to the schema. A builder does not have the problem, because the handle carries the
generics. That is the trade, stated plainly, and it belongs in the proposal rather than in a
footnote.

## Two schemas, not one — and `After` first

`Before` types the names the migration reads; `After` types every name and value it writes. One
schema cannot do both: with only the pre-migration schema, `to: "byline"` names a field that does
not exist yet; with only the post-migration schema, `field: "author"` names one that no longer does.

`After` comes first because one type parameter has to mean the schema people actually have, so
`TBefore` defaults to `TAfter` and the single-parameter shorthand is the same signature with the
default filled in — no overload, nothing to wreck. Under that shorthand reads widen to
`… | (string & {})`: a surviving name autocompletes, one the schema no longer has still compiles.
Writes stay exact either way. The measured cost is pinned as a test: under one schema a typo in a
_source_ name compiles, and `validateMigration` is what catches it, at run time, against the schema
the CLI pulled.

`Before` comes from a generated snapshot committed next to the migration and frozen once shipped
(`scripts/generate-before-snapshot.mjs`, run by `schema push` in the real design). It is scoped to
the blocks the migration touches plus everything reachable from them through a
`component_whitelist`. For the rename above, that is two blocks and 35 lines.

## The `under` rule, and chains

`under` filters a selection by ancestry, matched anywhere on the ancestor chain rather than on the
direct parent — so wrapping content one level deeper does not break the migration. It takes one
block name, or an outermost-first chain in which each name must appear above the next, gaps allowed:

```ts
alterField({ block: "meta", field: "og_title", under: "card" }, fn);
alterField({ block: "meta", field: "og_title", under: ["section", "card"] }, fn);
```

A key op never takes one. It moves the component schema, which is global, so migrating a subset
would leave every other instance holding a key no schema describes. Three guards enforce that, and
the spike needed all three. The key op specs _declare_ `under`, typed as the sentence explaining the
rule, rather than merely omitting it: excess-property checking fires only on a fresh object literal,
so an omitted key let a spread or a hoisted spec through, and the declared key catches both and
prints the reason. `validateMigration` refuses a migration whose key op carries one anyway, which is
the net for a `.js` migration or an author who cast around the types. And the runner ignores it, so
a key op that slipped past both still applies everywhere instead of half-applying.

This remains the one place the op list is weaker than the builder, whose `.under()` returned a
handle that structurally had no key ops. One rule, three enforcement points, versus one that could
not be expressed wrongly.

## Two sources of an inverse

1. **Recorded patches** (`src/patch.ts`, `src/runner.ts`) — the run has both trees, so it diffs each
   touched block and stores the inverse. Only these know what the migration actually wrote, so only
   they can tell an editor has since changed the field and skip that block.
2. **Derived inverse** (`src/derive-inverse.ts`) — a pure function of the op list. `renameField` and
   `moveField` invert to their mirror; a coercion inverts only when the author stated `from`.
   `removeField` cannot (the values are gone), and neither `alter` can (the output depends on the
   input). This tier exists only because the op list is data, and it is the one that covers "CI
   applied it, you want it gone locally".

The derived inverse is blind — it cannot see a concurrent edit — so patches win whenever they exist.

## Why there is no `down`

A schema `down` is symbolic: the inverse of adding a column is dropping it, and you can write it
without reading a row. A content `down` is not. Between the migration running and the rollback,
editors have been editing the very fields the migration touched, so an authored `down` replays a
transformation against content that has moved underneath it.

That makes `down` the weakest of the available inverses while looking like the strongest. A human
wrote it, so a CLI that offered it would be trusted, but it is the only one of the three that knows
neither what the migration wrote nor what has changed since. Recorded patches know both. The derived
inverse knows neither either, but it is a pure function of the op list, so it can be checked, and it
can declare itself underivable instead of guessing.

So `down` is not a third fallback, it is a worse copy of the second with a false claim to authority.
Dropping it also removes a whole reversed schema position from the type surface — `down` had to read
`MigrationOps<Before, After>`, the only place in the API where the two parameters swapped. Where no
inverse exists, you roll forward with a new migration: the same code, reviewed and logged, rather
than dead code nobody has executed.

Every forward-only tool in this space lands in the same place: Sanity, contentful-migration, Prisma
and Drizzle ship no down for data, and Rails documents its auto-inverse as off-limits for data
migrations.

## The journal

Removing `down` leaves recorded patches as the only inverse that knows anything, which makes where
those patches live a load-bearing question rather than a detail. `src/journal.ts` is the interface:

```ts
interface Journal {
  record(run: MigrationRun, inverse: StoryInverse[]): Promise<void>;
  list(space: string): Promise<MigrationRun[]>;
  read(id: string): Promise<MigrationRun | undefined>;
  readInverse(id: string): Promise<StoryInverse[]>;
}
```

**Two kinds of record, one interface.** A ledger entry is small, one per run, and is what a listing
prints — and it is also what answers "has this migration already run against this space?", a
question that is wrong to answer per-machine. The inverse patches are proportional to the content
touched and are read only during a rollback; a whole-space migration can produce megabytes of them.
Keeping them in separate methods is what lets a remote backend put the entry in a database row and
the patches in blob storage, and what stops `list` from pulling patch bodies to print a table.

They are not separate _interfaces_ because they share an id and a lifecycle: a run writes both or
neither, and a rollback reads both. Splitting them would let a caller store one without the other,
and the failure mode — an entry pointing at patches that were never written — only surfaces during
an incident. `record` takes both for that reason, and implementations write the patches first: an
orphaned patch object is inert, the reverse is not.

`src/journal-local.ts` is the default, a directory per space under `.storyblok/migrations` with two
files per run. `src/journal-mock-s3.ts` is the second implementation, which stores nothing and logs
what a real backend would send. `test/journal.test.ts` runs the same assertions against both,
because the point of the interface is that a rollback cannot tell which one it is reading from.
`scripts/run-against-space.ts` takes `SPIKE_JOURNAL=mock-s3` to swap them, which is what
demonstrates that its rollback phase reads through the interface rather than off a known path.

The patch files want gitignoring. Whether the ledger is committed is a real question and not one the
spike answers: committing it gives shared "has this run" for free at the cost of a merge conflict on
every run, and a committed ledger records _your machine's_ runs, which is not what anyone means by
shared.

### Concurrent runs

There is no locking, deliberately. The default backend is a local directory, and two machines do not
share one — which is exactly the case a lock exists for, so a lease that only holds when nobody else
is running would be theater. Lease semantics (TTL, renewal, breaking a lock held by a dead process)
is where an interface like this actually gets decided, and designing it against zero backends that
can enforce it would be guessing.

This is not a regression: the concurrent-run race exists today with no journal at all. A shared
journal makes it easier to notice, not easier to hit.

## Idempotency

Every `alter` runs twice per block and the two results must agree; a disagreement is reported as
`nonIdempotent` and the runner refuses the write. Key ops need no check: a rename is a no-op on the
second pass by construction. The measured cost, pinned in `test/editor-i18n.test.ts`: an author's
callback is invoked twice per block, so it must be free of side effects.

## Layout

| Path                                   | What it is                                                              |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `src/types.ts`                         | Path/name unions derived from a `Schema<typeof schema>`                 |
| `src/define-migration.ts`              | The two call shapes; carries the op list and `title`                    |
| `src/ops.ts`                           | The op factories and the type rules they enforce                        |
| `src/derive-inverse.ts`                | Rollback tier 2: the inverse computed from the op list alone            |
| `src/patch.ts`                         | `_uid`-addressed per-block patches; diff, inverse, conflict-aware apply |
| `src/runner.ts`                        | Applies a compiled migration to one story, emits patch + inverse        |
| `src/validate-migration.ts`            | Rejects ops the local schema does not define                            |
| `src/journal.ts`                       | Where a run's ledger entry and inverse patches live                     |
| `src/journal-local.ts`                 | The default journal: two files per run under `.storyblok/migrations`    |
| `src/journal-mock-s3.ts`               | A second backend that logs instead of storing, to show the swap         |
| `fixtures/schema.ts`                   | The pre-migration schema                                                |
| `fixtures/schema-after.ts`             | One post-migration schema per migration under test                      |
| `migrations/`                          | One migration per use case, plus a generated `.before.ts`               |
| `scenarios/has-spike-dsl-content/`     | Seed fixtures for the same content, for a real space                    |
| `scripts/generate-before-snapshot.mjs` | Emits the frozen `Before` snapshot from a space                         |
| `scripts/run-against-space.ts`         | The end-to-end probe against a real space                               |
| `test/*.test-d.ts`                     | Type-level assertions (36)                                              |
| `test/runner.test.ts`                  | Behaviour, incl. the surgical-rollback claim (54)                       |
| `test/validate-story.test.ts`          | Post-condition validation, against `After` (7)                          |
| `test/today.test.ts`                   | The CLI's current runner on the same fixtures, for comparison (5)       |

## Running

```bash
cd packages/schema/playground/vanilla/migrations-dsl-spike
../../../node_modules/.bin/vitest run --typecheck.enabled=false   # 78 behaviour tests
../../../node_modules/.bin/vitest run --typecheck.only            # 36 type tests
../../../node_modules/.bin/tsc --noEmit -p tsconfig.json
```

`tsc` reports two errors in `../base/datasources.ts` (`dimensions` entries are missing the required
`id`). Pre-existing and unrelated: the playground is excluded from the package tsconfig, so nothing
typechecks it today.

## Against a real space

```bash
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-spike-dsl-content \
  --scenario-dir packages/schema/playground/vanilla/migrations-dsl-spike/scenarios

set -a && source .env.qa-engineer-manual && set +a
cd packages/schema/playground/vanilla/migrations-dsl-spike
<tsx> scripts/run-against-space.ts --confirm-writes --phase roundtrip
```

`--phase migrate` / `--phase rollback` split the run so a story can be edited in between, which is
how the surgical-rollback claim is checked against content the migration did not write.

## What the space run settled

- **`_uid` survives a story update.** Every block uid came back unchanged across every probe, at
  every nesting depth, including a block embedded in a richtext field.
- **A `_uid` is only ever touched in two cases:** a block sent without one gets a generated UUID,
  and the second block repeating a `_uid` already used in the same story gets a fresh one. The
  runner reports both as `unstableUids` and refuses to write.
- **The Management API adds nothing to content.** A read-back after an update is identical to what
  was sent, modulo key order. `_editable` is a delivery API injection and is stripped on save, so it
  never reaches a migration reading through MAPI.
- **The API validates a field's `type` and nothing else.** A bogus `type` is a 422. A nonsense
  `restrict_type` and a `component_whitelist` naming a block that does not exist are both accepted
  verbatim. A successful push of a schema fixture proves storage, not shape.

## What the editor run settled

Driven with Playwright against the real Visual Editor (`scripts/drive-visual-editor.mjs`), reading
every result back through the Management API. Fixtures in `fixtures/editor-*.json` are those
read-backs verbatim; `test/editor-save.test.ts` runs the differ over them.

- **The ignore-list is complete as a transport-key list.** An editor save writes no key the
  Management API does not also write. No `_editable`, no reordering marker, no bookkeeping field, no
  `_uid` churn — every block came back with the uid it went in with, at every depth including inside
  a richtext field.
- **A save that changes one field changes one field.** Editing one `og_title` through the editor UI
  produced exactly one changed key in the whole tree, and the block it wrote is byte-identical in
  shape to the same block written through MAPI. The differ emits the single expected `set`.
- **A plain save changes nothing — unless the schema moved.** Opening a story and saving it without
  touching anything wrote no content at all (identical read-back, `updated_at` unmoved).
- **But the editor backfills schema defaults into the block in the form, and that is content.** Add
  a field to a component, then merely open a story on that component and hit save: the block gains
  that key with the field type's empty value — `""`, `false`, `[]`, an empty `multilink`, an empty
  `asset`, an empty richtext `doc`. Six keys appeared on a save with no user edit at all. The same
  happens to a nested block opened on its own (`/blok/<uid>`), and a key that is _absent_ comes back
  as `""` rather than staying absent. Blocks not in the form are left alone.

  This is the phantom-diff risk, and no ignore-list can address it: these are ordinary content keys
  that a migration could legitimately own. Consequences for rollback:
  - A migration that `unset`s a field can find it back as `""`, so the inverse `set` conflicts on
    `expect: undefined`.
  - Any story opened in the editor after a schema addition carries keys the migration's `before`
    snapshot does not have, on exactly the stories real editors touched.

  A rollback therefore has to treat "key absent → field-type empty value" as a non-conflict, or
  accept a conflict on every story an editor has opened since the schema last grew.

## What the second space run settled

Driven by `scripts/probe-write-paths.mjs` (Management + delivery API) and
`fixtures/editor-i18n-*.json` (Visual Editor read-backs, verbatim), with the space switched to
field-level translation and a second language added.

- **A field-level translation is a sibling key in the same block.** `author` holds the default
  language, `author__i18n__de` holds German; the language code is written with `-` replaced by `_`
  (`en-US` → `author__i18n__en_US`). Turning the per-field translate toggle on without typing writes
  the field type's empty value under the suffixed key.

- **The editor's backfill is language-unaware.** Saving in German backfilled `price: ""` and
  `promoted: false` on the bare keys and produced no `__i18n__` key at all. Only an actual write to
  the field, or the translate toggle, creates one.

- **A rename that moves only the base key destroys the translation.** With the component schema
  renamed too, the delivery API served `byline: "Ada Lovelace"` for `language=de` — the
  default-language value — because the orphan `author__i18n__de` no longer matches a translatable
  field. Carrying the family across gave `byline: "Ada auf Deutsch"`. Every op that names a field
  now names its `__i18n__` siblings; see `translationKeysFor` in `src/patch.ts`.

- **Publish adds nothing and normalizes nothing.** A publish is a copy of the draft. But a
  draft-only migration leaves the published version on the old shape until someone publishes, and a
  draft-only rollback cannot take it back: after rollback the draft held `author` while the
  published version still held `byline`.

- **Field constraints validate the base keys only.** With them on, a JSON number in a `number` field
  is a 422 (`must be a string with numbers and allow '-' and '.'`), `""` passes, a string in a
  `boolean` field is a 422, and the check reaches blocks nested inside a richtext field. A
  `__i18n__` key is never validated, whatever it holds.

- **A release is a separate content record.** A story written in a release does not touch the
  story's own content and is invisible to the plain story endpoints, so a migration over stories
  cannot see it. Deploying the release overwrites the story's draft wholesale.
