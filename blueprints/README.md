# Blueprints

Source of the template repos `storyblok create` uses. Each folder is synced to the repo of the same
name by `.github/workflows/sync-blueprints.yaml` (see `adr/0023-sync-blueprints-from-the-monorepo.md`).
`stage` composes each blueprint's `AGENTS.template.md` with `AGENTS.storyblok.md` into the target's
`AGENTS.md`. The template has another name so that agents working in this repo do not load it.

## Adding a blueprint

1. Create `blueprints/<repo-name>/` as a plain npm project: no lockfile (the sync resolves one), no `.github`, `workspace:^`
   for `@storyblok/*` packages from this repo.
2. Add an `AGENTS.template.md` with what the app is, the framework docs, and what the project's files don't
   say.
3. Add `tools/blueprint-sync/configs/<repo-name>.ts` and a `project.json` (copy a sibling's: the
   `blueprint` tag, `outputs`, `inputs`, the implicit dependency and `"smoke": {}`). Copy the `nx`
   key of its `package.json` too (`includedScripts: ["build"]`). `stage` ships neither.
4. Run `pnpm --filter @storyblok/blueprint-sync verify <repo-name>` (see
   `tools/blueprint-sync/README.md`), and again after every change.
5. Create the `storyblok/<repo-name>` repo, install the sync's GitHub App on it, and add it to the
   template list of `storyblok create` (`packages/cli/src/commands/create/constants.ts`).

Pull requests that touch `blueprints/**` or an SDK build and smoke-test the affected blueprints
against the workspace SDK source (the `blueprints` job in `ci.yaml`, ADR-0023).

## How nx sees blueprints

- Projects are inferred from each `package.json`, so `workspace:^` becomes a project dependency and
  `build` runs `^build` first. `nx.includedScripts: ["build"]` keeps nx from inferring `lint`, `test`,
  `dev` or `start`, because `project.json` cannot remove an inferred target. `stage` drops that key.
- `project.json` sets what `build` gets wrong: the `blueprint` tag, `outputs` per framework, `inputs`
  that skip `node_modules` and include the token, and an implicit dependency on
  `@storyblok/blueprint-sync`, so a change to the smoke test selects all seven. The `smoke` target
  is a default in `nx.json`, which each `project.json` opts into with `"smoke": {}`.
- The `blueprint` named input lists `blueprints/.pnpmfile.cjs` and `pnpm-workspace.yaml`, so a change
  to either selects all seven. `nx.json` is in `.nxignore`: editing the smoke default or the named
  input selects nothing, so run `pnpm nx smoke <blueprint>` by hand.
- There are two build targets. `build` is cached and token-free, with `STORYBLOK_DELIVERY_API_TOKEN`
  as a hash input, so a build made with a token never serves one made without. `smoke` is never
  cached: it builds with the token, which is baked into the output, and runs the smoke test.
  Smoke tasks run one at a time (`parallelism: false`) because the blueprints share ports 3000 and 4173.
- The `blueprints` job passes `--skip-nx-cache`. With `injectWorkspacePackages`, each blueprint holds
  a hard-linked copy of the SDK that pnpm refreshes only when the SDK's `build` script runs. After
  switching branches or restoring a build from the cache, `nx smoke` can test another branch's SDK
  build: run `pnpm install`, or the SDK build with `--skip-nx-cache`.

## Syncing

Run the **Sync blueprints** workflow with comma-separated folder names, or `all`. Verify locally first
(see above), and sync one blueprint before `all`.

The run stages every selected blueprint once (`stage`), tests exactly that tarball (`verify`), and
pushes it only if its checksum still matches (`push`). One red `verify` leg stops all pushes of the
run: sync the others by name.

A run for an older commit is refused by `push`: when the target's last commit is a sync commit, it
fails unless the commit being synced is ahead of that sync or identical to it. A commit made directly in a target, on top of the
last sync, switches that check off. Re-running an old run does not work either, and its tarballs
expire after a day: start a new run. A blueprint that needs an SDK change that is not on npm yet
fails the sync until the release: sync the others by name.

Runs of a ref go one at a time. A run that waits for approval holds its place, and a newer run waits
behind it. Of the runs waiting, only the newest stays, with its own inputs: a later run for one
blueprint replaces a waiting `all`. Reject a run you no longer want, or it blocks the next ones until
it times out.

`publish.yaml` calls the sync after every publish on `main`, including one that had nothing new to
publish. Reject the approval for those. The first sync after merging should be run by hand: reject
the first chained one.

## GitHub settings

The workflow cannot enforce these itself: a branch brings its own copy of the workflow file.

| Environment      | Used by                | Holds                                                        | Settings                                |
| ---------------- | ---------------------- | ------------------------------------------------------------ | --------------------------------------- |
| `production`     | `approve`, `publish.yaml` | nothing the sync reads                                    | required reviewers, deploy from `main`  |
| `blueprint-sync` | `push`                 | variable `BLUEPRINTS_APP_ID`, secret `BLUEPRINTS_APP_PRIVATE_KEY` | deploy from `main`                      |

`approve` reuses `production` as a plain approval gate. `blueprint-sync` stays separate so the App
key is never reachable from a job that runs under `production`.

- The App key is an environment secret, not a repository secret. In the App's settings, check that it
  is installed on the seven template repos only, with `contents: write` and no `workflows`.
- The demo token is the repository variable `BLUEPRINTS_DELIVERY_API_TOKEN`: read-only, and in every
  template's build, so not a secret. `verify` and the PR `blueprints` job both read it.
  `verify` runs untrusted install scripts, so give it nothing else. The PR job runs in
  `environment: test`, so a variable of that name on the environment overrides the repository one.
  When it is empty, the smoke step is skipped with a notice and the build still runs.
- `tools/blueprint-sync/` and `blueprints/` are owned by `@storyblok/dx` in CODEOWNERS, because
  `push` runs the scripts there with the App key. Ownership only requests the review. To make it
  block the merge, turn on "Require review from Code Owners" in the ruleset for `main`.
- The template repos' `main` must accept pushes from the App.
