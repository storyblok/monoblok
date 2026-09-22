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
function that returns one. Ops compose because they are values —
`BLOCKS.map((block) => removeField({ block, field: "gtm_id" }))` is a migration.

The spike's first question is whether the typing survives the move off the builder. A factory is
called in `defineMigration`'s argument list, where the schema appears in no argument, so every type
parameter has to reach it through the contextual return type. It does:
`test/define-migration.test-d.ts` pins a typo in a field name, a field borrowed from another block,
an unknown block, and a rename target the post-migration schema does not declare, all as compile
errors from a bare `defineMigration<After, Before>([…])`. The cost is a phantom property on every op
type — the type parameters must occur in the return type for the channel to exist at all.

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

It appears only in the signatures of the value ops. A key op moves the component schema, which is
global, so migrating a subset would leave every other instance holding a key no schema describes —
passing `under` to `renameField`, `moveField`, `removeField` or `coerceField` is an excess-property
error, and `validateMigration` repeats the check for a migration that never went through the type
system. This is the one place the op list is weaker than the builder, where `.under()` returned a
handle that structurally had no key ops: a better error message, not a different guarantee.

## Three sources of an inverse

1. **Recorded patches** (`src/patch.ts`, `src/runner.ts`) — the run has both trees, so it diffs each
   touched block and stores the inverse. Only these know what the migration actually wrote, so only
   they can tell an editor has since changed the field and skip that block.
2. **Derived inverse** (`src/derive-inverse.ts`) — a pure function of the op list. `renameField` and
   `moveField` invert to their mirror; a coercion inverts only when the author stated `from`.
   `removeField` cannot (the values are gone), and neither `alter` can (the output depends on the
   input). This tier exists only because `up` is data, and it is the one that covers "CI applied it,
   you want it gone locally".
3. **Authored `down`** — the object call shape, read in the other direction, so its schema
   parameters swap. The compiler enforces that: a `down` reading a field the migration renamed away
   is an error.

Tiers 2 and 3 are blind — they cannot see a concurrent edit — so patches win whenever they exist.

## Idempotency

Every `alter` runs twice per block and the two results must agree; a disagreement is reported as
`nonIdempotent` and the runner refuses the write. Key ops need no check: a rename is a no-op on the
second pass by construction. The measured cost, pinned in `test/editor-i18n.test.ts`: an author's
callback is invoked twice per block, so it must be free of side effects.

## Layout

| Path                                   | What it is                                                              |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `src/types.ts`                         | Path/name unions derived from a `Schema<typeof schema>`                 |
| `src/define-migration.ts`              | The two call shapes; carries the op list, `title` and `down`            |
| `src/ops.ts`                           | The op factories and the type rules they enforce                        |
| `src/derive-inverse.ts`                | Rollback tier 2: the inverse computed from the op list alone            |
| `src/patch.ts`                         | `_uid`-addressed per-block patches; diff, inverse, conflict-aware apply |
| `src/runner.ts`                        | Applies a compiled migration to one story, emits patch + inverse        |
| `src/validate-migration.ts`            | Rejects ops the local schema does not define                            |
| `fixtures/schema.ts`                   | The pre-migration schema                                                |
| `fixtures/schema-after.ts`             | One post-migration schema per migration under test                      |
| `migrations/`                          | One migration per use case, plus a generated `.before.ts`               |
| `scenarios/has-spike-dsl-content/`     | Seed fixtures for the same content, for a real space                    |
| `scripts/generate-before-snapshot.mjs` | Emits the frozen `Before` snapshot from a space                         |
| `scripts/run-against-space.ts`         | The end-to-end probe against a real space                               |
| `test/*.test-d.ts`                     | Type-level assertions (33)                                              |
| `test/runner.test.ts`                  | Behaviour, incl. the surgical-rollback claim (48)                       |
| `test/validate-story.test.ts`          | Post-condition validation, against `After` (7)                          |
| `test/today.test.ts`                   | The CLI's current runner on the same fixtures, for comparison (5)       |

## Running

```bash
cd packages/schema/playground/vanilla/migrations-dsl-spike
../../../node_modules/.bin/vitest run --typecheck.enabled=false   # 72 behaviour tests
../../../node_modules/.bin/vitest run --typecheck.only            # 33 type tests
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
