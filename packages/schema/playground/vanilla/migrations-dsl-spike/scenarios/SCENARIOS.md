# Spike scenarios

## `has-spike-dsl-content`

Seed for the `defineMigration` spike. Six components and two stories, shaped for the migration cases
under test:

- `spike_meta` appears at four depths under two different parents, plus once embedded in a richtext
  field — the "rename a field on a deeply nested block in multiple parents" case.
- `spike_card.legacy_price` / `.featured` hold strings that want coercing (one of them unparseable).
- `spike_card.old_slug` / `.slug` cover a value move onto a field that already has content.
- `spike_banner` is defined but used by no story — the zero-match case.

```bash
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-spike-dsl-content \
  --scenario-dir packages/schema/playground/vanilla/migrations-dsl-spike/scenarios
```

`fixtures/stories.ts` imports these story JSON files directly, so local tests and a seeded space
cannot drift.
