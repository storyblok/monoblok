# @storyblok/openapi-codegen

Internal workspace package. It owns the OpenAPI spec cache, the committed overlay specs, and the
shared `@hey-api/openapi-ts` generator invocation. Not published.

Every package with a `generate:openapi` target is a consumer. Today that is `@storyblok/api-client`,
`@storyblok/management-api-client`, `@storyblok/schema`, `@storyblok/live-preview`,
`@storyblok/experiments`, and `@storyblok/richtext`. Do not maintain that list by hand anywhere:
`pnpm nx run-many -t generate:openapi` resolves it from the target name, so a new consumer is picked
up automatically.

## Two spec sources

Generation reads from two places, and both of them can change the generated output:

- `.openapi-cache/` holds the public Content Delivery API and Management API specs fetched from the
  private `storyblok/openapi` repo. It is git-ignored, pinned by `spec.lock`, and populated by
  `pull`.
- `specs/` holds this repo's own overlay specs, including `specs/overlay.openapi.yaml` and the
  shared field-type shapes under `specs/shared/`. It **is** committed, so anyone can edit it in a
  normal PR without spec access.

The second source is the easier one to get wrong. Editing a file under `specs/` changes the
generated types for every consumer even though `spec.lock` does not move, so there is no lock diff
to remind you to regenerate.

## Workflow

```sh
# Refresh from upstream HEAD and update the lock.
pnpm --filter @storyblok/openapi-codegen pull:update

# Re-populate the cache at the SHA pinned in spec.lock (deterministic).
pnpm --filter @storyblok/openapi-codegen pull

# Verify the cache on disk matches spec.lock.
pnpm --filter @storyblok/openapi-codegen verify
```

Both `pull` commands require `gh auth status`. Specs live in the private `storyblok/openapi` repo.
`pull:update` leaves `spec.lock` untouched when the specs are unchanged upstream, even if the repo
has new commits.

You rarely need `pull:update` by hand: the [OpenAPI Spec Sync](#automated-sync) workflow runs it
daily.

`generate` verifies the cache content hash against `spec.lock` before running and fails fast on a
mismatch, so a stale cache left over from a different SHA can never silently produce divergent
output. Run `pull` to resync if it reports a mismatch.

## Regenerate consumers

**Whenever you change anything the generator reads, regenerate every consumer in the same PR.** That
means a `pull:update`, an edit under `specs/`, and a change to `src/` or `templates/`. Regenerating
only the package you happen to be working on leaves the others behind, and because these packages
export the same public types, the surface then disagrees across packages: a value
`@storyblok/schema` accepts fails to compile against `@storyblok/management-api-client`.

```sh
pnpm nx run-many -t generate:openapi
git add tools/openapi-codegen packages/*/src/generated
```

Regenerating a consumer that needs no update is free, so always run the whole set rather than
reasoning about which packages a spec change reaches.

To regenerate a single consumer while iterating, run its target directly. Run the full set again
before you commit:

```sh
pnpm nx run @storyblok/live-preview:generate:openapi
```

Nx caches this target and restores its declared outputs, so a regeneration can be silently replaced
by a cached copy of the previous output. Pass `--skip-nx-cache` if the diff looks empty when you
expect one, and confirm the working tree before committing.

## Why the upstream cache is not committed

The upstream repo is private, and checking its specs into this repo would expose them, so
`.openapi-cache/` stays local-only. External contributors can still build the repo without spec
access because each consumer commits its own `src/generated/` output. The overlay specs under
`specs/` are ours, so they are committed and reviewable.

## Why generated code IS committed

Two reasons. First, external contributor access: people without `storyblok/openapi` access can still
run `pnpm install && pnpm build` without fetching specs. Second, diff visibility: a spec update
produces a real diff in the consumer packages' `src/generated/` only when something type-relevant
changed. A PR that touches `spec.lock` or `specs/` with no consumer diff signals irrelevant churn. A
PR that touches either and produces a consumer diff signals a real surface-area change worth
reviewing.

## Version policy

Pinned at `0.0.1`. Updates here are chores, so consumers never get a dependency bump from spec
refreshes or internal refactors. Bump the version only when the exported API (`generate`,
`copyWrappers`) changes in a way that requires consumers to update their `scripts/generate.ts`.

## CI contract

Pull request CI never runs `pull`, `pull:update`, or any consumer `generate:openapi` target, because
generation needs the private spec cache. CI builds from committed `src/generated/`.

Nothing in pull request CI can therefore prove that the committed output is current. A PR that edits
`specs/` and regenerates only some consumers passes every check, and the packages left behind stay
stale until the next sync regenerates them. Reviewers are the only guard: when a PR touches
`spec.lock` or `specs/`, check that `packages/*/src/generated/` changed for every consumer the edit
reaches, or that the author states why none of them do.

## Automated sync

The OpenAPI Spec Sync workflow (`.github/workflows/openapi-sync.yaml`) runs daily and on demand. It
runs `pull:update` and, if `spec.lock` moved, regenerates every consumer and opens or updates one
pull request from the `chore/openapi-spec-sync` branch. CI then type-checks and tests the
regenerated output like any other change.

- The pull request is titled `chore(tools): …`, which releases nothing. When the generated diff
  changes a package's public types or SDK, retitle it to `feat(…)` or `fix(…)` before merging.
- Push fixes for consumers that no longer compile to the sync branch. The workflow leaves an open
  pull request with commits from anyone else untouched, so your fixes survive until it is merged or
  closed.
- The workflow authenticates as a GitHub App (`OPENAPI_SYNC_APP_ID`, `OPENAPI_SYNC_APP_PRIVATE_KEY`)
  installed on this repo and the spec repo. The app token both reads the private specs and opens the
  pull request; a pull request opened with the default `GITHUB_TOKEN` would not trigger CI.

## spec.lock

Committed. Pins the upstream commit SHA and a sha256 hash of the resulting cache contents:

```json
{
  "repo": "storyblok/openapi",
  "sha": "<upstream commit SHA>",
  "hash": "sha256:<hex>"
}
```

The hash protects against partial fetches and silent upstream force-pushes. `pull` recomputes the
hash after checking out the pinned SHA and fails if the content has shifted underneath us.
