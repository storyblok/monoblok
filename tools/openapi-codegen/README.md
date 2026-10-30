# @storyblok/openapi-codegen

Internal workspace package. It owns the upstream OpenAPI specs, our overlay specs, and the shared
`@hey-api/openapi-ts` generator invocation. Not published.

Every package with a `generate:openapi` target is a consumer. Today that is `@storyblok/api-client`,
`@storyblok/management-api-client`, `@storyblok/schema`, `@storyblok/live-preview`,
`@storyblok/experiments`, `@storyblok/richtext`, and `storyblok`. Do not maintain that list by hand
anywhere: `pnpm nx run-many -t generate:openapi` resolves it from the target name, so a new consumer
is picked up automatically.

## Two spec sources

Generation reads from two places, and both are committed:

- `upstream/` holds the public Content Delivery API and Management API specs, downloaded from the
  Storyblok docs by `pull` and pinned by `spec.lock`. Never edit them by hand: `generate` fails when
  they don't match `spec.lock`. Correct upstream gaps in `src/patches.ts` instead.
- `specs/` holds this repo's own overlay specs, including `specs/overlay.openapi.yaml` and the
  shared field-type shapes under `specs/shared/`.

## Generated output

Each consumer's `src/generated/` is git-ignored. Its `generate:openapi` target writes it, and the
`build`, `test`, `test:types`, `lint`, and `dev` targets depend on it, so any of those regenerates
it as needed. Nx caches the target on the specs, the generator, and the consumer's
`scripts/generate.ts`.

After a fresh clone, or when your editor shows stale types, regenerate every consumer:

```sh
pnpm nx run-many -t generate:openapi
```

The published packages ship their generated code in `dist/`, so consumers of the packages are not
affected.

## Update the upstream specs

```sh
pnpm --filter @storyblok/openapi-codegen pull
```

`pull` downloads the specs from `https://www.storyblok.com/docs/openapi-spec/`, regenerates
`src/known-types.ts`, and updates `spec.lock`. It needs no access to private repositories, so anyone
can update the specs.

You rarely need `pull` by hand: the [OpenAPI Spec Sync](#automated-sync) workflow runs it daily.

## Automated sync

The OpenAPI Spec Sync workflow (`.github/workflows/openapi-sync.yaml`) runs daily and on demand. It
runs `pull` and, if `spec.lock` moved, opens or updates one pull request from the
`chore/openapi-spec-sync` branch. CI then generates, type-checks, and tests every consumer against
the new specs.

- The pull request is titled `chore(tools): …`, which releases nothing. When the spec change reaches
  a package's public types or SDK, retitle it to `feat(…)` or `fix(…)` before merging.
- Push fixes for consumers that no longer compile to the sync branch. The workflow leaves an open
  pull request with commits from anyone else untouched, so your fixes survive until it is merged or
  closed.
- The workflow opens the pull request as a GitHub App (`OPENAPI_SYNC_APP_ID`,
  `OPENAPI_SYNC_APP_PRIVATE_KEY`) installed on this repo, because a pull request opened with the
  default `GITHUB_TOKEN` would not trigger CI.

## Version policy

Pinned at `0.0.1`. Updates here are chores, so consumers never get a dependency bump from spec
refreshes or internal refactors. Bump the version only when the exported API (`generate`,
`copyWrappers`) changes in a way that requires consumers to update their `scripts/generate.ts`.

## spec.lock

Committed. Records a sha256 hash of the contents of `upstream/`:

```json
{
  "hash": "sha256:<hex>"
}
```

`.gitattributes` keeps `upstream/` byte for byte on every platform, so the hash matches on Windows
checkouts too.
