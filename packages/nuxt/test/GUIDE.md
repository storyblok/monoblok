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

The session expires. When it does, the harness fails in its `auth` project and names the command
above; nothing else in the run proceeds.

## Per-run setup

**Confirm the QA space is free before any of this — every step writes to it.**

```bash
set -a && source ./.env.qa-engineer-manual && set +a

# Point the space's preview at the local playground (read-only without --confirm).
bash .agents/skills/qa-engineer-manual/scripts/configure-space.sh \
  --domain https://localhost:3200/ --confirm

# Seed the content tree the playground expects. This wipes the space first.
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-playground-content --scenario-dir packages/nuxt/test/scenarios

# Fill the relation references with the UUIDs the CLI just assigned.
node packages/nuxt/test/visual-editor/link-relations.mjs
```

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

## Two traps found while building this

- **`Cannot find package 'vue'` on the first `qa:dev`.** A stale `playground/.nuxt` cache, not an
  https problem. Delete `packages/nuxt/playground/.nuxt` and start again; the directory is
  gitignored and regenerates. Confirm it is the cache and not your change by starting `dev:e2e` on
  3100 — if that works, the cache is the culprit.
- **Killing `qa:dev` by its top PID leaves orphans.** The `pnpm` parent exits while the nuxi, nuxt,
  and nitro children keep port 3200 bound, so the next run reuses a server built from stale code.
  Kill the whole process tree, and check the port is actually free before re-running:
  `lsof -ti:3200 | xargs kill` then `lsof -ti:3200` returning nothing.
