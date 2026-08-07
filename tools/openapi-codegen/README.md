# @storyblok/openapi-codegen

Internal workspace package. It owns the OpenAPI spec cache and the shared `@hey-api/openapi-ts` generator invocation used by `@storyblok/api-client`, `@storyblok/management-api-client`, and `@storyblok/schema`. Not published.

## Workflow

```sh
# Refresh from upstream HEAD and update the lock.
pnpm --filter @storyblok/openapi-codegen pull:update

# Re-populate the cache at the SHA pinned in spec.lock (deterministic).
pnpm --filter @storyblok/openapi-codegen pull

# Verify the cache on disk matches spec.lock.
pnpm --filter @storyblok/openapi-codegen verify
```

Both `pull` commands require `gh auth status`. Specs live in the private `storyblok/openapi-wdx` repo.

`generate` verifies the cache content hash against `spec.lock` before running and fails fast on a mismatch, so a stale cache left over from a different SHA can never silently produce divergent output. Run `pull` to resync if it reports a mismatch.

After a `pull:update`, regenerate consumers and commit the diff:

```sh
pnpm nx run-many -t generate --projects=@storyblok/api-client,@storyblok/management-api-client,@storyblok/schema
git add tools/openapi-codegen/spec.lock packages/*/src/generated
```

To regenerate a single consumer, run its `generate` target directly:

```sh
pnpm nx run @storyblok/live-preview:generate
```

## Why specs are not committed

The bundled OpenAPI specs are git-ignored (`.openapi-cache/` is local-only). The upstream repo is private, and checking specs into this repo would expose them. External contributors can still build the repo without spec access because each consumer commits its own `src/generated/` output.

## Why generated code IS committed

Two reasons. First, external contributor access: people without `storyblok/openapi-wdx` access can still run `pnpm install && pnpm build` without fetching specs. Second, diff visibility: a spec update produces a real diff in the consumer packages' `src/generated/` only when something type-relevant changed. A PR that touches `spec.lock` with no consumer diff signals irrelevant spec churn. A PR that touches `spec.lock` and produces a consumer diff signals a real surface-area change worth reviewing.

## Version policy

Pinned at `0.0.1`. Updates here are chores, so consumers never get a dependency bump from spec refreshes or internal refactors. Bump the version only when the exported API (`generate`, `copyWrappers`) changes in a way that requires consumers to update their `scripts/generate.ts`.

## CI contract

CI never runs `pull`, `pull:update`, or any consumer `generate` target. CI builds from committed `src/generated/`. If `spec.lock` changes in a PR and the consumer generated code is stale, the resulting diff mismatch is reviewer-visible.

## spec.lock

Committed. Pins the upstream commit SHA and a sha256 hash of the resulting cache contents:

```json
{
  "repo": "storyblok/openapi-wdx",
  "sha": "<upstream commit SHA>",
  "hash": "sha256:<hex>"
}
```

The hash protects against partial fetches and silent upstream force-pushes. `pull` recomputes the hash after checking out the pinned SHA and fails if the content has shifted underneath us.
