# ADR-0026: Public OpenAPI Specs, Generated on Build, Synced Daily

**Status:** Accepted **Date:** 2026-10-30

Supersedes [ADR-0004](0004-openapi-specs-pulled-on-demand.md).

## Context

ADR-0004 kept the OpenAPI specs out of the repository because they lived in a private repository,
and committed each consumer's generated code instead, so external contributors could build without
spec access. Updating the specs was a manual step for someone with access.

That premise no longer holds: the Storyblok docs publish both the Content Delivery API and the
Management API specs. The old setup also had costs:

- Every spec change produced tens of thousands of lines of generated diff.
- Partial regeneration left consumers disagreeing on shared types.
- The manual update ran only when someone needed a new type, so the generated types fell behind the
  API.

## Decision

- **Pin the public specs, don't commit them.** The docs publish every spec version at a fixed URL,
  named by its content hash. `pull` pins the latest version of each spec in
  `tools/openapi-codegen/spec.lock.json` by URL and sha256. Generation downloads the pinned specs
  into a git-ignored cache and fails when a download doesn't match its pin. Upstream gaps are fixed
  in `patches.ts`.
- **Generate on demand, never commit the output.** `packages/*/src/generated/` is git-ignored.
  `pnpm install` generates it, and the build, test, lint, and watch targets depend on
  `generate:openapi` through Nx.
- **Commit a hash of each consumer's output.** `generate:openapi` writes `src/generated.sha256`. Nx
  release attributes a commit to the packages whose files it touches, so the hash is what lets a
  spec change release the packages it affects, and only those. CI fails when a hash is stale.
- **A scheduled workflow syncs the specs.** `.github/workflows/openapi-sync.yaml` runs `pull` daily
  and, when the pins change, opens or updates one pull request with the new pins, the regenerated
  hashes, and the spec diff in its description. A GitHub App opens it, because a pull request opened
  with the default `GITHUB_TOKEN` doesn't trigger CI. If the pull request has commits from anyone
  else, the workflow leaves it alone.

## Alternatives considered

- **Commit the specs and the generated output**, with a CI check for stale output. It keeps the
  generated type diff reviewable and needs no hash, but brings back the tens of thousands of lines
  of diff per spec change that this decision removes.
- **Commit the specs, generate the output.** No network access needed to build, but every spec
  change still adds tens of thousands of lines to the repository.
- **Always generate from the latest published specs, unpinned.** No lock and no sync pull request,
  but builds aren't reproducible, Nx can't cache generation, and an upstream change breaks CI on
  every open pull request until someone updates the hashes.
- **Keep pulling from the private repository.** External contributors still couldn't update the
  specs, and the generated types would keep falling behind.

## Consequences

- A sync pull request opens within a day of a published spec change, without anyone remembering to
  check. A spec change reaches the SDKs only after the docs publish it. To use API surface the docs
  don't publish yet, model it in `specs/` or `patches.ts` and remove that once upstream has it.
- Spec updates are reviewed as the spec diff in the sync pull request's description, which also
  lists the packages whose generated code changes. Reviewers who want the generated type diff
  regenerate locally.
- Generating without a cached copy of the pinned specs needs network access, including
  `pnpm install` on a fresh clone. Old commits stay buildable as long as the docs keep serving the
  versions they pin.
- The workflow titles each sync pull request `chore(tools): …`, which releases nothing. Reviewers
  retitle it to `feat` or `fix` when the change reaches what a package exposes, and squash-merge it.
- All consumers always build from the same specs, so they can't drift apart.
- Package scripts run outside Nx, such as `pnpm --filter <package> build`, don't regenerate. After
  pulling spec or generator changes, run `pnpm nx run-many -t generate:openapi`.
- Published packages are unaffected: they ship the generated code in `dist/`.

Links: DX-676.
