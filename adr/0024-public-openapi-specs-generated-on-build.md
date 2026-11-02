# ADR-0024: Public OpenAPI Specs, Generated on Build, Synced Daily

**Status:** Accepted **Date:** 2026-10-30

Supersedes [ADR-0004](0004-openapi-specs-pulled-on-demand.md).

## Context

ADR-0004 kept the OpenAPI specs out of the repository because they lived in a private repository,
and committed each consumer's generated code instead, so external contributors could build without
spec access. Updating the specs was a manual step for someone with access.

That premise no longer holds. The Storyblok docs publish both the Content Delivery API and the
Management API spec, and the committed generated code already exposed nearly all of their content:
every path, parameter, and schema, plus most descriptions. Meanwhile, the old setup cost us:

- Every spec change produced tens of thousands of lines of generated diff.
- Partial regeneration left consumers disagreeing on shared types, and nothing in CI caught it.
- The manual update ran only when someone needed a new type, so the generated types fell behind the
  API.

## Decision

- **Commit the public specs.** `pull` downloads both specs byte for byte from
  `https://www.storyblok.com/docs/openapi-spec/` into `tools/openapi-codegen/upstream/`. It needs no
  access to a private repository, so anyone can update the specs. `spec.lock` records their hash,
  and `generate` rejects specs that don't match it, so upstream gaps are fixed in `patches.ts`,
  never by editing a spec. `.gitattributes` keeps the files byte-identical on Windows checkouts.
- **Generate on demand, never commit the output.** `packages/*/src/generated/` is git-ignored.
  `build`, `test`, `test:types`, `lint`, and the watch targets depend on `generate:openapi` through
  Nx `targetDefaults`, and Nx caches it on the specs, the generator, and each consumer's script.
- **A scheduled workflow syncs the specs.** `.github/workflows/openapi-sync.yaml` runs daily. It
  runs `pull` and stops when `spec.lock` doesn't move. Otherwise, it opens or updates a single pull
  request with the new specs, and CI regenerates, type-checks, and tests every consumer against
  them.
- **A GitHub App opens the sync pull request.** A pull request opened with the default
  `GITHUB_TOKEN` doesn't trigger CI.
- **The workflow leaves human work alone.** If the open sync pull request has commits from anyone
  else, for example fixes for consumers that no longer compile, the workflow skips the run instead
  of replacing the branch.

## Consequences

- Generated types follow the published specs within a day, without anyone remembering to update
  them. A spec change reaches the SDKs only after the docs publish it.
- Spec updates are reviewed as spec diffs. Reviewers who want the generated type diff regenerate
  locally.
- Each sync pull request needs a review. The workflow titles it `chore(tools): …`, which releases
  nothing. Reviewers retitle it to `feat` or `fix` when the change reaches a package's public
  surface.
- All consumers always build from the same specs, so they can't drift apart.
- A fresh clone has no generated code until a task that depends on it runs. Editors show missing
  types until then; `pnpm nx run-many -t generate:openapi` fixes that.
- Published packages are unaffected: they ship the generated code in `dist/`.
- An org admin must create the GitHub App, install it on this repository, and add its ID and private
  key as repository secrets.

Links: DX-676.
