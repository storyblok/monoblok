# ADR-0007: OpenAPI Specs Pulled on Demand

**Status:** Accepted
**Date:** 2026-05-27

## Context

The `@storyblok/management-api-client`, `@storyblok/api-client`, and `@storyblok/schema` packages generate their public types and (for the clients) their SDK code from OpenAPI specifications. Previously, the specs lived in a workspace package, `@storyblok/openapi`, that bundled YAML files into `dist/` at build time. Every consumer declared a workspace dependency on it, and nx wired `generate` to run after the openapi build.

The specs now live in a private repository, `storyblok/openapi-wdx`, with overlay applied. The monorepo continues to be open to external contributors who do not have access to that repository.

A separate concern from WDX-430 motivates the same change: cross-package coupling on a single shared types package caused unrelated version bumps to cascade across consumers. Each consumer should own the types it needs, generated from the same upstream contract.

## Decision

Remove `@storyblok/openapi` as a workspace package. Pull specs on demand into a workspace-root `.openapi-cache/` directory via a manual script, and commit each consumer's `src/generated/` output so external contributors can build the monorepo without access to the spec repository.

### Fetch script

A root script, `pnpm fetch:specs` (`tools/fetch-openapi-specs.ts`), clones `storyblok/openapi-wdx` through the `gh` CLI, copies the overlay-applied specs into `.openapi-cache/{mapi,capi}/`, and then runs `pnpm nx run-many -t generate --projects=@storyblok/management-api-client,@storyblok/api-client,@storyblok/schema` so every consumer regenerates in the same invocation. Resulting diffs in each package's `src/generated/` surface in `git status` and serve as the breaking-change report. The script requires `gh auth status`, is documented as manual, and is never run in CI.

### Per-consumer generation

Each consumer's `generate` target reads from `.openapi-cache/` directly. There is no shared types package: `@storyblok/management-api-client` and `@storyblok/api-client` own their own generated types and do not depend on `@storyblok/schema`. The CLI does not depend on `@storyblok/schema` either. Version bumps continue to use changesets, scoped to the package whose generated output changed.

### Cache lifecycle

`.openapi-cache/` is gitignored. Contributors without spec access build from the committed `src/generated/` output. Contributors with access run `pnpm fetch:specs` whenever specs change upstream and review the resulting diffs.

## Consequences

- External contributors can build, lint, test, and modify the monorepo without spec access.
- Spec changes flow through the monorepo as committed `src/generated/` diffs, reviewed in pull requests.
- Version bumps are scoped per consumer, not driven by a shared types package.
- The fetch script is the only path that requires the private repository; CI builds use the committed artifacts.
- Spec updates require a manual fetch, a regeneration, and a commit by someone with access.

Links: WDX-406, WDX-430.
