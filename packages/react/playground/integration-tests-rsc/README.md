# React RSC Integration-Test Playground

The RSC counterpart to `../integration-tests`: same schema (`src/schema/blocks.ts`), same components
and `data-test` attributes, same seeded fixture — but served through Next.js App Router with
`StoryblokPreview` from `@storyblok/react/rsc` (Server Actions, not the client `useStoryblokState`
hook), so the Visual Editor QA suite can exercise the RSC live-preview path too, not just the
client-side one.

It depends on `@storyblok/react` as a normal workspace package (its built `dist`), not an alias to
`src`, so QA exercises what a real consumer imports — matching `../integration-tests`.

## Bridge-enabled vs. bridge-disabled

The catch-all route renders the same story two ways, same as `../integration-tests`:

- **Live** — through `StoryblokPreview` (`@storyblok/react/rsc`), which re-invokes the
  `renderContent` Server Action (`src/lib/actions.tsx`) on every bridge `input` event.
- **Static** (`data-test="static-teaser-headline"`) — the story fetched on request, rendered
  directly. It never goes through `StoryblokPreview`, so it never subscribes to editor events and
  never changes. This proves the bridge is opt-in per call, not a page-wide default.

## Run the app

From the repository root, with `.env.qa-engineer-manual` exported:

```bash
set -a && source ./.env.qa-engineer-manual && set +a
pnpm --filter @storyblok/react qa:dev:rsc
```

This builds `@storyblok/react` and starts the app over HTTPS at `https://localhost:5274/`. When it
starts, it updates the Storyblok space's default preview domain to `https://localhost:5274/`. Run
that step on its own with:

```bash
pnpm --filter @storyblok/playground-react-integration-tests-rsc configure:preview
```

`STORYBLOK_ACCESS_TOKEN` is required for seeded content; without it the app falls back to the same
shared public demo space `playground/react` uses.

## Seed fixtures

Shared with `../integration-tests` — same scenario, same `_uid`s:

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
pnpm --filter @storyblok/react qa:editor:rsc
```

`qa:editor:rsc` runs the exact same spec as `qa:editor`
(`test/visual-editor/specs/live-editing.spec.ts`) with `QA_TARGET=rsc`, which points
`test/visual-editor/qa.config.ts` at this playground's port instead of `../integration-tests`'.
