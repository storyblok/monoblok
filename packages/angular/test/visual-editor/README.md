# Angular Visual Editor QA

This test drives the dedicated `live-preview` story through the real Storyblok Visual Editor. The
fixture is served by the dedicated integration-test playground; the manual SSR playground is not
modified by the broker test harness. The Storyblok preview domain should be configured as
`https://localhost:4200/`. The `env=Angular` selector belongs only to the Storyblok editor URL and
is added by the QA harness automatically.

The seeded story must contain:

- A `featured-articles` block with at least one selected article in `articles`.
- An `article` block with at least one selected story in `author`.
- The seeded article's rich-text body rendered during SSR for the preflight health check.
- An editable `title` field on the article block.

### Scenario seeds

Use the provided [scenario](../../playground/integration-tests/seeds/has-live-preview-qa) to seed
the QA space with the fixture this test drives. Run from the repository root:

```bash
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-live-preview-qa \
  --scenario-dir packages/angular/playground/integration-tests/seeds
```

Run it with:

```bash
set -a && source ./.env.qa-engineer-manual && set +a
node .agents/skills/qa-engineer-manual/scripts/save-storyblok-session.mjs
pnpm --filter @storyblok/angular qa:editor
```

The test runs single-subscriber, same-tick, sequential, reverse-sequential, and delayed-second-
subscriber scenarios. It also verifies teardown and re-subscription. Do not save or publish while
debugging because the test expects the current story content to remain available for the next case.

For every scenario it asserts three things that one-bridge-per-subscriber would fail:

- The subscribers whose callback fires on a single `input`, and the ones that must not.
- The relations that arrive resolved, read from the rendered text rather than the element count. An
  unresolved relation is a uuid string, so the block still renders, just with an empty label.
- That the preview page gained exactly one `message` listener, measured as a delta against a
  baseline taken before the first subscription.

Fan-out and relation resolution are asserted separately: after unsubscribing A, the bridge is not
rebuilt, so A's relation stays resolved while only B's callback fires.
