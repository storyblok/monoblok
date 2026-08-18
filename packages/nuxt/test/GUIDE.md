# @storyblok/nuxt manual QA guide

Manual QA for this package means the Storyblok Visual Editor. The generic checks, the per-run setup,
and the teardown live in the `qa-engineer-manual` skill's Visual Editor checklist. This guide covers
only what is specific to this package.

## Values this package uses

| What           | Value                                        |
| -------------- | -------------------------------------------- |
| Preview domain | `https://localhost:3200/`                    |
| Scenario       | `has-playground-content` in `test/scenarios` |

No extra seed step: the seed is everything the harness needs.

## Run

```bash
set -a && source ./.env.qa-engineer-manual && set +a
export NUXT_PUBLIC_STORYBLOK_ACCESS_TOKEN="$STORYBLOK_PREVIEW_TOKEN"
pnpm --filter @storyblok/nuxt qa:editor
```

The token must be the key whose `access` is `private`. The playground requests `version: "draft"`,
and a `public` key returns published content only, so a `public` token yields empty stories for
unpublished seed data, with no error to tell you why.

The harness starts the https playground itself on port 3200 and reuses an already-running one. It
runs single-worker: the specs share one seeded space, and a parallel re-seed produces failures that
look like product defects.

Three specs cover what only the real editor can exercise: the story renders in the preview frame,
typing updates the preview before any save, and a resolved relation survives a live edit. Everything
the playground renders standalone belongs in the Cypress suite
(`pnpm --filter @storyblok/nuxt cy:run`), not here.

For a check the specs do not cover, write a throwaway script instead of adding one. The skill's
`examples/visual-editor-run.mjs` is the starting point.

## Notes

- `NUXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` overrides the demo token committed in
  `playground/nuxt.config.ts`, because the module assigns `runtimeConfig.public.storyblok`
  wholesale. The playground needs no edit.
- The playground's slugs are hardcoded under `vue/`, which is why the seed mirrors that tree.
- Don't add an `en` language to the space. The playground requests `language: "en"` and CAPI falls
  back to default-language content; the shared demo space configures only `es` and works fine.
- The editor previews a story at its `full_slug`, so it loads `/vue/articles/first-article`, which
  the catch-all route serves, not the playground's own `/articles/:slug`.
- Every app-side selector lives in `test/visual-editor/editor.page.ts`. When a Storyblok release
  breaks the harness, that is the file to repair.
- The `feature` component in the shared demo space has a `native-color-picker` field. The seed omits
  it deliberately: the playground never reads it, and a plugin field adds an install dependency.
- No live-editing coverage for richtext. Driving the editor's contenteditable is brittle, and the
  editor's preview path for that story renders `body`, not `richText`.

## Known quirks

- **Save and publish need `editor.save()` / `editor.publish()`, not a bare button click.** Both wait
  for the preview reload, because live-updating means the preview already shows the new text before
  the save: asserting the text alone passes with a dead reload path. `publish()` also dismisses the
  "Unpublished linked story" modal that a fresh seed always triggers.
- **The specs edit fields without ever saving.** They rely on the seeded text being intact when a
  run starts. If you click Save while debugging in the editor, later runs fail on the seeded-text
  assertions with no hint why. Re-seed.
- **`Cannot find package 'vue'` on the first `qa:dev`.** A stale `playground/.nuxt` cache, not an
  https problem. Delete `packages/nuxt/playground/.nuxt` and start again; the directory is
  gitignored and regenerates. Confirm it is the cache and not your change by starting `dev:e2e` on
  3100: if that works, the cache is the culprit.
- **Killing `qa:dev` by its top PID leaves orphans.** The `pnpm` parent exits while the nuxi, nuxt,
  and nitro children keep port 3200 bound, so the next run reuses a server built from stale code.
  Kill the whole process tree, then confirm the port is free: `lsof -ti:3200 | xargs kill`, then
  `lsof -ti:3200` printing nothing.
- **`WARN You might need NODE_TLS_REJECT_UNAUTHORIZED=0` from `qa:dev` is noise.** Nuxi prints it
  whenever it serves its own self-signed certificate. Playwright accepts that cert through
  `ignoreHTTPSErrors`, so nothing needs the variable.
- **A blank preview frame in your own browser is Chrome, not the bridge.** The harness disables the
  Local Network Access checks via launch args; a browser you drive yourself blocks the iframe and
  renders a `chrome-error` page instead.
