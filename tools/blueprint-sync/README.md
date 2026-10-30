# @storyblok/blueprint-sync

Internal. Stages, smoke-tests and verifies the blueprints in `blueprints/` for
`.github/workflows/sync-blueprints.yaml`. CI runs the same commands as a local run.

All three commands run from the repo root as `pnpm --filter @storyblok/blueprint-sync <command>` and
need the delivery token (see below), except `stage`.

| Command                                    | Tests                                   | What it does                                                                      |
| ------------------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------- |
| `stage <blueprint> <dir>`                  | nothing                                 | Writes what the sync pushes, plus a lockfile. Installs and builds nothing.        |
| `smoke <blueprint>`                        | the blueprint against the workspace SDK | Builds in place, then runs the smoke test. No stage, no install.                  |
| `verify <blueprint> [dir \| --from <dir>]` | the blueprint as users get it           | Stages (or takes a staged tree), runs `npm ci`, builds, then runs the smoke test. |

The smoke test is a browser test of the demo story in your installed Chrome: no page errors or
`console.error`, and the demo texts rendered. `smoke` and `verify` run the same test.

## Stage a blueprint

`stage <blueprint> <dir>` writes only what the sync pushes (`workspace:^` becomes `^` plus the
version `npm view` reports as `latest`, so it needs network), plus a `package-lock.json` resolved
with `npm install --package-lock-only --ignore-scripts --allow-remote=all` (npm 12 defaults
`allow-remote` to `none`). It installs and tests nothing. It only writes into a directory that is
empty or does not exist, and never one inside this repository (compared by real path).

## Smoke-test a blueprint against the workspace SDK

`pnpm nx smoke blueprint-core-vue` runs `smoke`: it builds the blueprint in place, against the SDK
source nx has built, and runs the smoke test (needs the token in `.env`). CI runs it for the
affected blueprints (ADR-0023). It stages and installs nothing, so it does not test what users get:
use `verify` for that. Files a config's `beforeBuild` rewrites are restored afterwards.

## Verify a blueprint

Run after every change to a blueprint, its config in `configs/`, or
`blueprints/AGENTS.storyblok.md`:

```sh
cp tools/blueprint-sync/.env.template tools/blueprint-sync/.env   # once, then add the token
pnpm --filter @storyblok/blueprint-sync verify blueprint-core-nextjs
```

`verify` stages the blueprint into a new temp directory as the sync would push it, runs `npm ci`
against the lockfile the stage wrote, builds, starts, and runs the smoke test. Pass a directory as
the second argument to choose where.

`verify <blueprint> --from <dir>` skips staging and the lockfile and tests a tree `stage` already
wrote, as is. The sync's `stage` job writes the tarball that `verify` tests from and `push` ships,
so the lockfile tested is the lockfile shipped. To try it locally:

```sh
pnpm --filter @storyblok/blueprint-sync stage blueprint-core-nextjs /tmp/staged
pnpm --filter @storyblok/blueprint-sync verify blueprint-core-nextjs --from /tmp/staged
```

`verify` writes the `.env` that `storyblok create` would (token and region) and runs build and start
without those two variables in the process env. Blueprints that server-render must also have the
demo texts in the HTML the server sends. `smoke` and `verify` stop with an error when the token is
not set.

`verify` simulates `storyblok create` and does not run it. Angular has no `.env`: its config copies
the CLI's replacement of the environment files, and the token stays in the build environment.

Per-framework quirks live in `configs/`:

- Astro is served with `astro dev`, because its Vercel adapter has no `preview`.
- Nuxt's preview takes the host as `HOST`: the workspace lockfile pins a Nuxt CLI that reads
  `--host` as the project folder.
- Only Nuxt, Svelte and Next.js wait for hydration (`ready`). Angular's `serverRendered` is off:
  `ng build` prerenders no routes.
- Angular rewrites its own sources during the build. `writes` lists those files, and `smoke`
  snapshots and restores them on every exit path, so the token never stays in a tracked file. A copy
  would not work: pnpm's `node_modules` links do not resolve from another folder.
- The smoke test retries once in CI.

The token is the read-only delivery token of the shared blueprint demo space, the
`BLUEPRINTS_DELIVERY_API_TOKEN` repository variable. The token in `.env.qa-engineer-manual` belongs
to your own QA space, which lacks the demo content.

`stage` and `verify` need npm 11 or newer (Node 24). npm 10.9.x crashes resolving
`blueprint-core-angular` and `blueprint-core-nuxt` without a lockfile
(`Cannot read properties of null (reading 'edgesOut')`), which is why the sync ships one.

The tool runs on macOS and Linux only: it starts npm without a shell and its configs set variables
in the start command. `scripts/unpack-tarball.sh` is what the workflow runs on the tarball `stage`
made: before `verify` installs it, and in `push`, after it passed through `verify`.
