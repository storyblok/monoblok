# @storyblok/openapi-codegen

Internal workspace package. It owns the upstream OpenAPI spec pins, our overlay specs, and the
shared `@hey-api/openapi-ts` generator invocation. Not published.

Every package with a `generate:openapi` target is a consumer; `pnpm nx run-many -t generate:openapi`
resolves them by target name.

## Two spec sources

Generation reads from two places:

- The public Content Delivery API and Management API specs, which the Storyblok docs publish at a
  fixed URL per version. `spec.lock.json` pins one version of each by URL and sha256. Generation
  downloads them into the git-ignored `.openapi-cache/` and fails when a download doesn't match its
  pin. Never edit the lock by hand: `pull` writes it. Correct upstream gaps in `src/patches.ts`.
- `specs/` holds this repo's own overlay specs, including `specs/overlay.openapi.yaml` and the
  shared field-type shapes under `specs/shared/`.

## Generated output

Each consumer's `src/generated/` is git-ignored. Its `generate:openapi` target writes it, and
`pnpm install`, the build, test, lint, and watch targets run that target. Nx caches it on
`spec.lock.json`, the overlay specs, the generator, and the consumer's `scripts/generate.ts`.
Generating without a cached copy of the pinned specs needs network access.

To regenerate every consumer, for example after pulling spec or generator changes:

```sh
pnpm nx run-many -t generate:openapi
```

`generate:openapi` also writes `src/generated.sha256`, a hash of the generated code. Commit it: a
change to the generated code then touches the package, so a `feat` or `fix` commit releases it. CI
fails when a committed hash is stale.

## Update the spec pins

```sh
pnpm --filter @storyblok/openapi-codegen pull
```

`pull` reads the latest versions from `https://www.storyblok.com/docs/openapi-spec/latest.json`,
pins them in `spec.lock.json`, and regenerates `src/known-types.ts`. It validates the specs first
and writes nothing when they fail, for example when an `ALIASES` source no longer exists upstream.
Fix the alias, then run `pull` again.

You rarely need `pull` by hand: the [OpenAPI Spec Sync](#automated-sync) workflow runs it daily.

## Automated sync

The OpenAPI Spec Sync workflow (`.github/workflows/openapi-sync.yaml`) runs daily and on demand. It
runs `pull`, regenerates every consumer, and, if the pins changed, opens or updates one pull request
from the `chore/openapi-spec-sync` branch. Its description includes the spec diff. CI then
type-checks and tests every consumer against the new specs.

- The pull request lists the packages whose generated code changes. It is titled `chore(tools): …`,
  which releases nothing. When the change reaches what a package exposes, retitle it to `feat(…)` or
  `fix(…)` and squash-merge it.
- Push fixes for consumers that no longer compile to the sync branch. The workflow leaves an open
  pull request with commits from anyone else untouched, so your fixes survive until it is merged or
  closed.
- When the published specs match `main` again, the workflow closes an open sync pull request that
  only has its own commits.
- When `pull` fails, the run fails and no pull request opens. Check the failed run in the
  **Actions** tab.
- The workflow authenticates as a GitHub App (`OPENAPI_SYNC_APP_ID`, `OPENAPI_SYNC_APP_PRIVATE_KEY`)
  so its pull requests trigger CI.

## Version policy

Pinned at `0.0.1`. Updates here are chores, so consumers never get a dependency bump from spec
refreshes or internal refactors. Bump the version only when the exported API (`generate`,
`copyWrappers`) changes in a way that requires consumers to update their `scripts/generate.ts`.
