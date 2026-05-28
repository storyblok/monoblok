# ADR-0007: OpenAPI Specs Pulled on Demand

**Status:** Accepted
**Date:** 2026-05-27

## Context

The `@storyblok/management-api-client`, `@storyblok/api-client`, and `@storyblok/schema` packages generate their public types and (for the clients) their SDK code from OpenAPI specifications. Previously, the specs lived in a workspace package, `@storyblok/openapi`, that bundled YAML files into `dist/` at build time. Every consumer declared a workspace dependency on it, and nx wired `generate` to run after the openapi build.

The specs now live in a private repository, `storyblok/openapi-wdx`, with overlay applied. The monorepo continues to be open to external contributors who do not have access to that repository.

A separate concern from WDX-430 motivates the same change: cross-package coupling on a single shared types package caused unrelated version bumps to cascade across consumers. Each consumer should own the types it needs, generated from the same upstream contract.

## Decision

Remove `@storyblok/openapi` as a workspace package. Introduce a private internal workspace package, `@storyblok/openapi-codegen` (at `tools/openapi-codegen/`, because the repo convention is `tools/` for internal, never-published tools and `packages/` for public artifacts), that owns spec fetching, the local spec cache, and the shared `@hey-api/openapi-ts` generator invocation. Commit each consumer's `src/generated/` output so external contributors can build the monorepo without access to the spec repository.

Centralizing the generator (rather than only the spec cache) eliminates a byte-for-byte duplicated `@hey-api/openapi-ts` invocation and dedup pass that previously lived in each consumer's `scripts/generate.ts`, and it keeps consumers consistent: every consumer's generated types come from the same generator version against the same spec snapshot, without a shared types package whose version would bump on every spec change regardless of whether the consumer's slice of the surface was affected.

A rejected alternative was to split the bundled upstream spec by `tags` in the fetch step to preserve the previous per-resource folder layout in each consumer. Rejected because the slicing convention is not guaranteed by upstream, so a tag rename upstream would silently break the consumer file layout. The current design mirrors the upstream document shape directly.

### `@storyblok/openapi-codegen`

The codegen package exposes three scripts:

- `pnpm --filter @storyblok/openapi-codegen pull` clones `storyblok/openapi-wdx` through the `gh` CLI at the commit SHA pinned in `spec.lock`, populates `tools/openapi-codegen/.openapi-cache/{mapi,capi}/`, recomputes the cache content hash, and fails if it does not match the hash recorded in `spec.lock` (force-push protection).
- `pnpm --filter @storyblok/openapi-codegen pull:update` clones upstream HEAD, populates the cache, and rewrites `spec.lock` with the new SHA and hash.
- `pnpm --filter @storyblok/openapi-codegen verify` recomputes the cache content hash and compares it to `spec.lock`, failing fast on missing or stale caches. This is the basis for the nx `build` target that consumer `generate` targets depend on, so codegen cannot run against a stale or absent cache.

The package exports a single `generate(config)` entry point. A consumer lists the public type names it needs and (for the clients) the SDK surface it owns; the tool resolves names to specs, walks transitive dependencies, runs `@hey-api/openapi-ts` once per affected surface, applies the per-resource dedup pass when an SDK is emitted, and stamps the generic wrapper templates into the consumer output. Consumer `generate` scripts collapse to a one-line call. `include` is typed against a committed `KnownType` union so consumers get autocomplete without running `pull` themselves.

### Aliases and naming

Most upstream types are exposed only under their package-stable public name. The codegen tool's `aliases.ts` maps each upstream schema to the emitted public name and, where the upstream shape is a request envelope, narrows it to the entity body. Example: upstream `UpdateStoryRequest` becomes `StoryUpdate` (the body of the `story` property), and upstream `CreateAsset` becomes `AssetCreate`. Where the upstream name is already clean and matches the public surface, no alias is needed.

Some entity names exist in both specs with materially different shapes (`Story`, `Asset`, `Datasource`, `DatasourceEntry`). A small explicit list resolves the collision by giving the MAPI variant a `Mapi` prefix or suffix (`MapiStory`, `MapiDatasourceEntry`), keeping the bare name for the CAPI variant. The list is auditable, and a missed duplicate fails loudly at generation time as a TypeScript redeclaration error rather than silently.

`Component` and `Block` are the single deliberate dual exposure: the clients request `Component` (closer to the OpenAPI surface), and the higher-level packages (`@storyblok/schema`, `@storyblok/live-preview`) request `Block` (closer to the published API).

For entity types that have both a slim PUT-response shape and a canonical GET-response shape upstream, the alias sources from the GET shape. Example: `Asset` is sourced from `ShowAsset`, not from the upstream `Asset` (which is the slim V2 PUT-response). This keeps the public entity type aligned with what consumers actually read.

### Transitive resolution

A consumer lists the types it wants by name. The tool resolves each name to a spec, walks the transitive dependency graph (including the wrapper templates' leaf imports), and writes the minimum slice that compiles. A CAPI-only `include: ['Story']` still emits a `mapi/types.gen.ts` because the `Block` wrapper depends on `Component`, but only the slice of MAPI that `Component` and `Field` transitively require. Each consumer's `src/generated/` is the minimum that compiles its public surface.

### `spec.lock`

Committed to the repository. Pins the upstream commit SHA and a sha256 hash of the resulting cache contents. The hash protects against silent upstream force-pushes and partial fetches: a `pull` against the pinned SHA reproduces the same bytes or it fails.

### Per-consumer generation

Each consumer's `generate` target reads from the codegen package's cache via the shared `generate()` function and writes to its own `src/generated/`. There is no shared types package: `@storyblok/management-api-client` and `@storyblok/api-client` own their own generated types and do not depend on `@storyblok/schema`. The CLI does not depend on `@storyblok/schema` either. Version bumps continue to use changesets, scoped to the package whose generated output changed.

### Codegen version policy

`@storyblok/openapi-codegen` is pinned at `0.0.1`. Updates here are chores, so consumers never get a dependency bump from spec refreshes, hash updates, or internal refactors. Bump the version only when the exported `generate` API changes in a way that requires consumers to update their `scripts/generate.ts`.

### Cache lifecycle

`tools/openapi-codegen/.openapi-cache/` is git-ignored. Contributors without spec access build from the committed `src/generated/` output. Contributors with access run `pnpm --filter @storyblok/openapi-codegen pull:update` whenever specs change upstream, regenerate the consumers explicitly (`pnpm nx run-many -t generate --projects=@storyblok/api-client,@storyblok/management-api-client,@storyblok/schema`), and commit the resulting diffs in `spec.lock` and each consumer's `src/generated/`. `pull:update` also regenerates the committed `known-types.ts` catalog so the lock and the autocomplete-driving type union move together.

## Consequences

- External contributors can build, lint, test, and modify the monorepo without spec access.
- Spec changes flow through the monorepo as committed `src/generated/` diffs, reviewed in pull requests. A `spec.lock` change with no consumer diff signals irrelevant spec churn. A `spec.lock` change with a consumer diff signals a real surface-area change worth reviewing.
- Version bumps are scoped per consumer, not driven by a shared types package, and never driven by the codegen package.
- The fetch scripts are the only path that requires the private repository; CI builds use the committed artifacts and never run `pull`, `pull:update`, or any consumer `generate` target.
- `spec.lock` makes spec snapshots deterministic and detects silent upstream changes.
- Spec updates require a manual fetch, a regeneration, and a commit by someone with access.

Links: WDX-406, WDX-430.
