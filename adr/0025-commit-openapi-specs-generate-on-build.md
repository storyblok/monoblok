# ADR-0025: Commit OpenAPI Specs, Generate Code on Build

**Status:** Accepted **Date:** 2026-10-30

Supersedes [ADR-0004](0004-openapi-specs-pulled-on-demand.md). Amends
[ADR-0024](0024-automated-openapi-spec-sync.md).

## Context

ADR-0004 kept the OpenAPI specs out of the repository because they were private, and committed each
consumer's generated code instead, so external contributors could build without spec access.

That premise no longer holds. The Storyblok docs publish both specs, and the committed generated
code already exposed nearly all of their content: every Management API path, parameter, and schema,
plus most descriptions. Meanwhile, committed generated code cost us:

- Every spec change produced tens of thousands of lines of generated diff.
- Partial regeneration left consumers disagreeing on shared types, and nothing in CI caught it.
- Contributors had to remember to regenerate every consumer after touching the generator or the
  specs.

## Decision

- **Commit the upstream specs.** `tools/openapi-codegen/upstream/` holds the Content Delivery API
  and Management API specs, downloaded byte for byte by `pull` from
  `https://www.storyblok.com/docs/openapi-spec/`. `spec.lock` records their hash, and `generate`
  rejects specs that don't match it, so upstream gaps are fixed in `patches.ts`, never by editing a
  spec. `.gitattributes` keeps the files byte-identical on Windows checkouts.
- **Generate on demand, never commit the output.** `packages/*/src/generated/` is git-ignored.
  `build`, `test`, `test:types`, `lint`, and the watch targets depend on `generate:openapi` through
  Nx `targetDefaults`, and Nx caches it on the specs, the generator, and each consumer's script.
- **Download from public URLs.** `pull` needs no access to a private repository, so anyone can
  update the specs, and the sync workflow's GitHub App only needs this repository.
- **The sync pull request carries only the specs.** The workflow from ADR-0024 no longer regenerates
  anything. CI regenerates, type-checks, and tests every consumer against the new specs.

## Consequences

- Spec updates are reviewed as spec diffs. Reviewers who want the generated type diff regenerate
  locally.
- All consumers always build from the same specs, so they can't drift apart.
- A fresh clone has no generated code until a task that depends on it runs. Editors show missing
  types until then; `pnpm nx run-many -t generate:openapi` fixes that.
- External contributors can update the specs, regenerate, and change the generator: nothing they
  need is private.
- The specs follow the docs site, which syncs from the spec source repository by pull request. A
  spec change reaches the SDKs only after the docs publish it.
- Published packages are unaffected: they ship the generated code in `dist/`.

Links: DX-676.
