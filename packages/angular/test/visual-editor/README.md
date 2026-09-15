# Angular Visual Editor QA

This test drives the dedicated `angular/live-preview-qa` story through the real Storyblok Visual
Editor. The fixture is directly available at `/angular/live-preview-qa`; the standard `/` Home
playground route is not modified by the broker test harness.

The `home` story must contain:

- A `featured-articles` block with at least one selected article in `articles`.
- An `article` block with at least one selected story in `author`.
- An editable `title` field on the article block.

Run it with:

```bash
set -a && source ./.env.qa-engineer-manual && set +a
node .agents/skills/qa-engineer-manual/scripts/save-storyblok-session.mjs
pnpm --filter @storyblok/angular qa:editor
```

The test runs single-subscriber, same-tick, sequential, reverse-sequential, and delayed-second-
subscriber scenarios. It also verifies teardown and re-subscription. Do not save or publish while
debugging because the test expects the current story content to remain available for the next case.
