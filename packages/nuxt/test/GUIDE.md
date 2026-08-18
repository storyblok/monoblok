# @storyblok/nuxt manual QA guide

Manual QA for this package means the Storyblok Visual Editor. Load
[Visual Editor checks](../../../.agents/skills/qa-engineer-manual/visual-editor-checklist.md) first.

## One-time setup

Requires `mkcert` on `PATH` (`brew install mkcert`). Nothing in the harness checks for it; a missing
binary surfaces as a failing `qa:certs`.

```bash
# 1. A locally-trusted certificate. The editor is https and blocks an http iframe.
mkcert -install
pnpm --filter @storyblok/nuxt qa:certs

# 2. An app session. Opens a headed browser; log in yourself, 2FA and all.
pnpm --filter @storyblok/nuxt qa:auth
```

`qa:auth` watches the browser, not the terminal: it polls for a session cookie and saves as soon as
you are logged in, then closes the window by itself. Nothing to confirm at the prompt, so an agent
can start it for you while you only touch the browser. It waits 15 minutes, then gives up. Your
credentials are never read or stored — only the resulting session state, which is gitignored.

The session expires. When it does, the harness fails in its `auth` project and names the command
above; nothing else in the run proceeds.

## Per-run setup

**Confirm the QA space is free before any of this — every step writes to it.**

```bash
set -a && source ./.env.qa-engineer-manual && set +a

# Read and record the `current:` domain this prints, you restore it below.
bash .agents/skills/qa-engineer-manual/scripts/configure-space.sh

# Point the space's preview at the local playground (read-only without --confirm).
bash .agents/skills/qa-engineer-manual/scripts/configure-space.sh \
  --domain https://localhost:3200/ --confirm

# Seed the content tree the playground expects. This wipes the space first.
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-playground-content --scenario-dir packages/nuxt/test/scenarios

# Fill the relation references with the UUIDs the CLI just assigned.
node packages/nuxt/test/visual-editor/link-relations.mjs
```

When you're done, restore the domain you recorded, with the same script:

```bash
bash .agents/skills/qa-engineer-manual/scripts/configure-space.sh \
  --domain <the recorded current: value> --confirm
```

Nothing does this automatically. Leaving the space pointed at the playground means the next person
to open it in the editor gets a blank preview with no error.

## Run

```bash
export NUXT_PUBLIC_STORYBLOK_ACCESS_TOKEN="<the space API key whose access is 'private'>"
pnpm --filter @storyblok/nuxt qa:editor
```

The token must be the key whose `access` is `private`. The playground requests `version: "draft"`,
and a `public` key returns published content only — so a `public` token yields empty stories for
unpublished seed data, with no error to tell you why.

The harness starts the https playground itself on port 3200 and reuses an already-running one. It
runs single-worker: the specs share one seeded space, and a parallel re-seed produces failures that
look like product defects.

## Notes

- `NUXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` overrides the demo token committed in
  `playground/nuxt.config.ts`, because the module assigns `runtimeConfig.public.storyblok`
  wholesale. The playground needs no edit.
- The playground's slugs are hardcoded under `vue/`, which is why the seed mirrors that tree.
- Don't add an `en` language to the space. The playground requests `language: "en"` and CAPI falls
  back to default-language content; the shared demo space configures only `es` and works fine.
- Every app-side selector lives in `test/visual-editor/editor.page.ts`. When a Storyblok release
  breaks the harness, that is the file to repair.
- The `feature` component in the shared demo space has a `native-color-picker` field. The seed omits
  it deliberately: the playground never reads it, and a plugin field adds an install dependency.
- `pnpm --filter @storyblok/nuxt qa:verify-scenario` catches scenario drift: it asserts the
  `has-playground-content` scenario defines a component for every component the playground can
  render. Nothing runs it automatically; run it yourself after editing the scenario or the
  playground's components.

## Three traps found while building this

- **The editor specs edit fields without ever saving.** They rely on the seeded text being intact
  when a run starts. If you click Save while debugging in the editor, later runs fail on the
  seeded-text assertions with no hint why. Re-seed with `seed-scenario.sh` (see Per-run setup) if
  this happens.

- **`Cannot find package 'vue'` on the first `qa:dev`.** A stale `playground/.nuxt` cache, not an
  https problem. Delete `packages/nuxt/playground/.nuxt` and start again; the directory is
  gitignored and regenerates. Confirm it is the cache and not your change by starting `dev:e2e` on
  3100 — if that works, the cache is the culprit.
- **A blank preview frame is usually Chrome, not the bridge.** The editor is served from a public
  origin and embeds the playground from localhost, which Chrome's Local Network Access policy blocks
  with `net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`. The frame then renders a `chrome-error`
  page that looks exactly like a dead bridge. The harness disables those checks via Chromium launch
  args in `playwright.config.ts`; if you drive the editor in your own browser instead, expect to hit
  this and to have to allow it.
- **Killing `qa:dev` by its top PID leaves orphans.** The `pnpm` parent exits while the nuxi, nuxt,
  and nitro children keep port 3200 bound, so the next run reuses a server built from stale code.
  Kill the whole process tree, and check the port is actually free before re-running:
  `lsof -ti:3200 | xargs kill` then `lsof -ti:3200` returning nothing.
