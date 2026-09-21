# `defineMigration` DSL — feasibility spike

**Status: spike. Prototype quality, not a shipped API.** Lives in the schema playground on purpose;
placement is an open question.

Probes the proposed content-migrations DSL that ties `@storyblok/migrations` to `@storyblok/schema`:

```ts
export default defineMigration<Schema>({
  up: (m) => m.field("article.author").renameTo("byline"),
});
```

## Layout

| Path                               | What it is                                                              |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `src/types.ts`                     | Path/name unions derived from a `Schema<typeof schema>`                 |
| `src/define-migration.ts`          | The builder under test; compiles `up` into declarative ops              |
| `src/patch.ts`                     | `_uid`-addressed per-block patches; diff, inverse, conflict-aware apply |
| `src/runner.ts`                    | Applies a compiled migration to one story, emits patch + inverse        |
| `src/validate-migration.ts`        | Rejects ops the local schema does not define                            |
| `fixtures/`                        | The "before" schema and the story content the probes run on             |
| `migrations/`                      | One migration per use case under test                                   |
| `scenarios/has-spike-dsl-content/` | Seed fixtures for the same content, for a real space                    |
| `test/*.test-d.ts`                 | Type-level assertions (16)                                              |
| `test/runner.test.ts`              | Behaviour, incl. the surgical-rollback claim (24)                       |
| `test/validate-story.test.ts`      | What post-condition validation actually reports (5)                     |
| `test/today.test.ts`               | The CLI's current runner on the same fixtures, for comparison (5)       |

## Running

```bash
cd packages/schema/playground/vanilla/migrations-dsl-spike
../../../node_modules/.bin/vitest run --typecheck.enabled=false   # 34 behaviour tests
../../../node_modules/.bin/vitest run --typecheck.only            # 16 type tests
../../../node_modules/.bin/tsc --noEmit -p tsconfig.json
```

`tsc` reports two errors in `../base/datasources.ts` (`dimensions` entries are missing the required
`id`). Pre-existing and unrelated: the playground is excluded from the package tsconfig, so nothing
typechecks it today.

## What still needs a real space

`scripts/run-against-space.mjs` is written but **has not been run** — the QA space was taken out of
scope mid-probe. It covers the four things local fixtures cannot settle:

1. that MAPI round-trips a renamed / removed / coerced field at all;
2. that `_uid`s survive a story update — the whole patch scheme rests on this;
3. that server-set or editor-set keys (`_editable`, normalization) do not surface as spurious diff
   ops, which would read as rollback conflicts;
4. that an inverse replayed later still lands on the right blocks after real editor activity.
