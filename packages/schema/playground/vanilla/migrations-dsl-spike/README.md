# `defineMigration` DSL: feasibility spike

**Status: spike. Prototype quality, not a shipped API.** Lives in the schema playground on purpose;
placement is an open question.

Probes the proposed content-migrations DSL that ties `@storyblok/migrations` to `@storyblok/schema`:

```ts
import type { Before } from "./0001-rename-byline.before";
import type { Schema as After } from "../schema";

export default defineMigration<Before, After>({
  up: (m) => m.field("article.author").renameTo("byline"),
});
```

## Two schemas, not one

`Before` types the paths the migration reads; `After` types every name and value it writes. One
schema cannot do both: with only the pre-migration schema, `renameTo("byline")` names a field that
does not exist yet; with only the post-migration schema, `field("article.author")` names one that no
longer does. Either authoring order was a compile error.

`Before` comes from a generated snapshot committed next to the migration and frozen once shipped
(`scripts/generate-before-snapshot.mjs`, run by `schema push` in the real design). It is scoped to
the blocks the migration touches plus everything reachable from them through a
`component_whitelist`. For the rename above, that is two blocks and 35 lines.

`TAfter` defaults to `TBefore`, so the single-schema shorthand `defineMigration<Schema>` is the same
signature with the default filled in rather than an overload. Nothing to wreck.

## Layout

| Path                                   | What it is                                                              |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `src/types.ts`                         | Path/name unions derived from a `Schema<typeof schema>`                 |
| `src/define-migration.ts`              | The builder under test; compiles `up` into declarative ops              |
| `src/patch.ts`                         | `_uid`-addressed per-block patches; diff, inverse, conflict-aware apply |
| `src/runner.ts`                        | Applies a compiled migration to one story, emits patch + inverse        |
| `src/validate-migration.ts`            | Rejects ops the local schema does not define                            |
| `fixtures/schema.ts`                   | The pre-migration schema                                                |
| `fixtures/schema-after.ts`             | One post-migration schema per migration under test                      |
| `migrations/`                          | One migration per use case, plus a generated `.before.ts`               |
| `scenarios/has-spike-dsl-content/`     | Seed fixtures for the same content, for a real space                    |
| `scripts/generate-before-snapshot.mjs` | Emits the frozen `Before` snapshot from a space                         |
| `scripts/run-against-space.ts`         | The end-to-end probe against a real space                               |
| `test/*.test-d.ts`                     | Type-level assertions (24)                                              |
| `test/runner.test.ts`                  | Behaviour, incl. the surgical-rollback claim (35)                       |
| `test/validate-story.test.ts`          | Post-condition validation, against `After` (7)                          |
| `test/today.test.ts`                   | The CLI's current runner on the same fixtures, for comparison (5)       |

## Running

```bash
cd packages/schema/playground/vanilla/migrations-dsl-spike
../../../node_modules/.bin/vitest run --typecheck.enabled=false   # 47 behaviour tests
../../../node_modules/.bin/vitest run --typecheck.only            # 24 type tests
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
