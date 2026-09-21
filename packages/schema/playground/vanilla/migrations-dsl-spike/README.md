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
