# Angular Integration-Test Playground

This playground is the deterministic Angular app used by the Visual Editor broker tests. It is
separate from the manual SSR playground so QA-only routes, fixtures, and runtime configuration do
not affect the Angular demos.

## Run the app

From the repository root, with `.env.qa-engineer-manual` exported:

```bash
set -a && source ./.env.qa-engineer-manual && set +a
pnpm --filter @storyblok/angular-integration-tests start
```

This starts the dedicated SSR app over HTTPS at `https://localhost:4200/`, using whatever
`@storyblok/angular`/`@storyblok/live-preview` build is already on disk. It does **not** rebuild
dependencies, update the space's preview domain, or clear the prebundled dep cache — for QA runs,
use the Angular package's `qa:dev` script instead, which does all three before starting the app.

When `qa:dev` starts, it updates the Storyblok space's default preview domain to
`https://localhost:4200/`. Run the configuration step directly with:

```bash
pnpm --filter @storyblok/angular-integration-tests configure:preview
```

The QA route is available at `https://localhost:4200/`, with `/live-preview` and
`/angular/integration-tests/live-preview` also available for direct access.
`STORYBLOK_PREVIEW_TOKEN` is required for local startup; source `.env.qa-engineer-manual` before
starting the app.

## Seed fixtures

See [the QA scenario seed command](../../../test/visual-editor/README.md#scenario-seeds), run from
the repository root.

Do not commit access tokens or generated runtime configuration.

## Run Visual Editor QA

```bash
set -a && source ./.env.qa-engineer-manual && set +a
node .agents/skills/qa-engineer-manual/scripts/save-storyblok-session.mjs
pnpm --filter @storyblok/angular qa:editor
```
