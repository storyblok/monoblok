# ADR-0004: OpenAPI Specs Pulled on Demand

**Status:** Accepted
**Date:** 2026-05-27

## Context

Several packages generate their public types (and, for the API clients, SDK code) from Storyblok's OpenAPI specifications. Those specifications are maintained in a private backend repository and have never been public. The monorepo previously carried its own **hand-written** copy of the spec, bundled into a public workspace package, `@storyblok/openapi`, that every consumer depended on.

Two pressures motivated a change:

- The hand-written spec is a second source of truth that can drift from the backend, and the plan is to stop shipping any OpenAPI spec as a public artifact in the monorepo. The authoritative, overlay-applied specs live in a private repository (`storyblok/openapi-wdx`) that external contributors cannot access, yet the monorepo must stay buildable by them.
- A single shared types package coupled unrelated consumers: any spec change bumped the shared package, cascading version bumps to every dependent regardless of whether its slice of the surface actually changed (WDX-430).

## Decision

Remove the shared `@storyblok/openapi` package. Introduce a private, never-published internal tool, `@storyblok/openapi-codegen` (under `tools/`, per the convention that `tools/` holds internal tooling and `packages/` holds published artifacts), that owns spec fetching and the shared generator invocation. Each consumer commits its own generated output.

Key choices:

- **Specs are fetched on demand, never hand-written or bundled.** The tool clones the private spec repo at a SHA pinned in `spec.lock`; the local cache is git-ignored. `spec.lock` also records a content hash so a fetch reproduces the same bytes or fails (protection against silent upstream force-pushes). No OpenAPI spec lives in the monorepo as a public artifact.
- **Each consumer owns its generated types.** Every consumer commits its `src/generated/` output and lists the type names it needs; the tool emits the minimum slice that compiles. There is no shared types package, so version bumps stay scoped to the consumer whose generated output actually changed.
- **External contributors build from committed output.** Spec changes surface as reviewable `src/generated/` diffs in pull requests. CI never fetches specs or runs `generate`; it builds from committed artifacts. Fetching and regenerating is a deliberate, manual step done by someone with spec access.
- **The codegen tool is pinned at `0.0.1`.** Spec refreshes and internal refactors are chores, so consumers are never bumped by them. The version moves only if the tool's public `generate` API changes.

## Consequences

- External contributors can still build, lint, test, and modify the monorepo without spec access.
- Spec snapshots are deterministic and pinned; irrelevant spec churn is visible as a `spec.lock` change with no consumer diff, and real surface changes show as consumer diffs worth reviewing.
- Version bumps are scoped per consumer, never driven by a shared types package or by the codegen tool.
- Spec updates require a manual fetch, regeneration, and commit by someone with access. CI cannot do it.

Links: WDX-406, WDX-430.
