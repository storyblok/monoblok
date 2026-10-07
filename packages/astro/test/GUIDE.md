# @storyblok/astro manual QA guide

Manual QA for this package means the Storyblok Visual Editor. The generic checks, the per-run setup,
and the teardown live in the `qa-engineer-manual` skill's Visual Editor checklist. This guide covers
only what is specific to this package.

## Values this package uses

| What           | Value                                        |
| -------------- | -------------------------------------------- |
| Preview domain | `https://localhost:4321/`                    |
| Scenario       | `has-playground-content` in `test/scenarios` |
| App under test | `playground/ssr`                             |

**Live editing works in both SSR and SSG.** The Visual Editor bridge drives DOM updates client-side
regardless of Astro's rendering mode; only `getPayload`/`storyblokPreviewMiddleware` (used to read
the Visual Editor's POST body during an SSR render) require `output: "server"`. `playground/ssr`
wires `storyblokPreviewMiddleware` via `src/middleware.ts` and renders
`<StoryblokPreview liveUpdate />` in its layout; `playground/ssg` does not, so edits there reload on
`change`/`published` only.

## Run

```bash
set -a && source ./.env.qa-engineer-manual && set +a
export STORYBLOK_ACCESS_TOKEN="$STORYBLOK_PREVIEW_TOKEN"
pnpm --filter @storyblok/astro qa:editor
```

The token must be the key whose `access` is `private`. The playground requests `version: "draft"`,
and a `public` key returns published content only, so a `public` token yields empty stories for
unpublished seed data, with no error to tell you why.

The harness starts the https playground itself and reuses an already-running one. It runs
single-worker: the specs share one seeded space, and a parallel re-seed produces failures that look
like product defects.

Stop the server with `pnpm --filter @storyblok/astro qa:stop`.

## Notes

- `STORYBLOK_ACCESS_TOKEN` overrides the demo token committed in `playground/*/astro.config.mjs`.
  Both playgrounds read it; without it they serve the shared demo space and every seeded-content
  assertion fails for a reason that looks like a bridge problem.
- Blocks are addressed by the `_uid` the scenario seeded (`editor.block("teaser-home-1")`), not by a
  `data-test` attribute: the playground components carry almost none, and `storyblokEditable` emits
  `data-blok-uid="<storyId>-<uid>"` on every one of them anyway.
- The editor previews a story at its `full_slug`, so it loads `/home`, which `[...slug].astro`
  serves.
- `article` has no Astro component on purpose. The two article stories exist only as relation
  targets that `FeaturedArticles.astro` renders from the resolved story object (`name`,
  `full_slug`).
- The `test` slug is special: `[...slug].astro` skips rendering `<StoryblokPreview />` entirely for
  `test` and `contact`. `about-us` is a dedicated static route
  (`playground/ssr/src/pages/about-us.astro`) that renders it without `liveUpdate`, so it reloads on
  save/publish but never live-morphs the DOM.
- Every app-side selector lives in `tools/visual-editor-qa/src/editor.page.ts`, which this package
  shares with the other framework harnesses. When a Storyblok release breaks the harness, that is
  the file to repair, and the fix lands for every package at once. This package supplies only its
  own `test/visual-editor/qa.config.ts` and its specs.
- No live-editing coverage for richtext. Driving the editor's contenteditable is brittle.

## Known quirks

- **`astro dev` daemonizes whenever stdout is not a TTY.** It prints a JSON banner with a pid and
  exits, so `nohup … &`, `start-server-and-test`, and Playwright's `webServer` all see a process
  that exited immediately. Control it with `astro dev status` / `astro dev logs` / `astro dev stop`,
  never by killing a pid you captured yourself. `qa:dev` starts the daemon and then follows its logs
  so Playwright has something long-running to wait on.
- **`--port` is a request, not a guarantee.** When the port is taken, `astro dev` silently serves
  the next free one and only the banner says so. The space's preview domain must match exactly, and
  a mismatch yields a blank preview frame with no error, identical to a dead bridge. If the preview
  is blank, check `astro dev status` before suspecting the plugin.
- **A stale background server serves stale code.** It survives every `qa:editor` run, so a
  `qa:editor` after a code change can silently test the old build. `qa:stop` between changes.
- **The specs edit fields, and the last three save or publish.** A run therefore leaves the space
  mutated and the story published. The preflight fails the next run with a re-seed instruction. Just
  re-seed.
- **Publish opens a confirmation modal** ("Unpublished linked story") because the seeded relation
  targets are unpublished. `editor.publish()` dismisses it. Without that, the publish never happens
  and the missing preview reload reads as a broken bridge.
- **A blank preview frame in your own browser is Chrome, not the bridge.** The harness disables the
  Local Network Access checks via launch args; a browser you drive yourself blocks the iframe and
  renders a `chrome-error` page instead.
