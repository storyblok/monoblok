# React Integration-Test Playground

This playground is the deterministic React app used by the Visual Editor QA harness. It replicates
`playground/react`'s setup (same `defineStoryblokComponents`/`createApiClient` pattern, same SWR
fetch hook) but is kept separate so QA-only routes and fixtures do not affect the manual demo, and
it depends on `@storyblok/react` as a normal workspace package (its built `dist`), not an alias to
`src`, so QA exercises what a real consumer imports.

Components are typed against `schema/blocks.ts`, defined with `@storyblok/schema`. The API client is
narrowed with `apiClient.withTypes<StoryblokSchema>()`, so `story.content` is a discriminated union
of the seeded block shapes instead of `unknown`.

## Bridge-enabled vs. bridge-disabled

The catch-all route renders the same story two ways:

- **Live** — through `StoryblokPreview`, which subscribes to the bridge; an editor `input` event
  replaces its content immediately.
- **Static** (`data-test="static-teaser-headline"`) — the story fetched on mount, rendered directly.
  It never calls `StoryblokPreview`/`useStoryblokState`, so it never subscribes to editor events and
  never changes. This proves the bridge is opt-in per call, not a page-wide default.

## Run the app

From the repository root, with `.env.qa-engineer-manual` exported:

```bash
set -a && source ./.env.qa-engineer-manual && set +a
pnpm --filter @storyblok/react qa:dev
```

This builds `@storyblok/react` and starts the dedicated app over HTTPS at `https://localhost:5273/`.
When it starts, it updates the Storyblok space's default preview domain to
`https://localhost:5273/`. Run that step on its own with:

```bash
pnpm --filter @storyblok/playground-react-integration-tests configure:preview
```

`STORYBLOK_ACCESS_TOKEN` is required for seeded content; without it the app falls back to the same
shared public demo space `playground/react` uses.

## Seed fixtures

From the repository root:

```bash
set -a && source ./.env.qa-engineer-manual && set +a
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-playground-content --scenario-dir packages/react/test/scenarios
```

Do not commit access tokens or generated runtime configuration.

## Run Visual Editor QA

```bash
set -a && source ./.env.qa-engineer-manual && set +a
node .agents/skills/qa-engineer-manual/scripts/save-storyblok-session.mjs
pnpm --filter @storyblok/react qa:editor
```
