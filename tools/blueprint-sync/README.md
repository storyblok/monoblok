# @storyblok/blueprint-sync

Internal. Stages and verifies the blueprints in `blueprints/` for
`.github/workflows/sync-blueprints.yaml`. CI runs the same commands as a local run.

## Check a blueprint against the workspace SDK

`pnpm nx smoke blueprint-core-vue` builds the blueprint in place, against the SDK source nx has
built, and runs the same browser check as `verify` (needs the token in `.env`). CI runs it for the
affected blueprints (ADR-0022). It stages and installs nothing, so it does not test what users get:
use `verify` for that. Files a config's `beforeBuild` rewrites are restored afterwards.

## Verify a blueprint

Run after every change to a blueprint, its config in `configs/`, or
`blueprints/AGENTS.storyblok.md`:

```sh
cp tools/blueprint-sync/.env.template tools/blueprint-sync/.env   # once, then add the token
pnpm --filter @storyblok/blueprint-sync verify blueprint-core-nextjs
```

`verify` stages the blueprint into a new temp directory as the sync would push it, runs `npm ci`
against the lockfile the stage wrote, builds, starts, and checks the demo story in your installed
Chrome. Pass a directory as the second argument to choose where.

`verify <blueprint> --from <dir>` skips staging and the lockfile and tests a tree `stage` already
wrote, as is. The sync's `stage` job writes the tarball that `verify` tests from and `push` ships,
so the lockfile tested is the lockfile shipped. To try it locally:

```sh
pnpm --filter @storyblok/blueprint-sync stage blueprint-core-nextjs /tmp/staged
pnpm --filter @storyblok/blueprint-sync verify blueprint-core-nextjs --from /tmp/staged
```

`verify` writes the `.env` that `storyblok create` would (token and region) and runs build and start
without those two variables in the process env. Blueprints that server-render must also have the
demo texts in the HTML the server sends. `stage` only writes into a directory that is empty or does
not exist, and never one inside this repository (compared by real path). Both commands stop with an
error when the token is not set.

The token is the read-only delivery token of the shared blueprint demo space, the
`BLUEPRINTS_DELIVERY_API_TOKEN` repository variable. The token in `.env.qa-engineer-manual` belongs
to your own QA space, which lacks the demo content.

`stage <blueprint> <dir>` writes only what the sync pushes (`workspace:^` becomes `^` plus the
version `npm view` reports as `latest`, so it needs network), plus a `package-lock.json` resolved
with `npm install --package-lock-only --ignore-scripts`. It installs and checks nothing.

`stage` and `verify` need npm 11 or newer (Node 24). npm 10.9.x crashes resolving
`blueprint-core-angular` and `blueprint-core-nuxt` without a lockfile
(`Cannot read properties of null (reading 'edgesOut')`), which is why the sync ships one.

The tool runs on macOS and Linux only: it starts npm without a shell and its configs set variables
in the start command. `scripts/unpack-tarball.sh` is what the workflow runs on the tarball `stage`
made: before `verify` installs it, and in `push`, after it passed through `verify`.
