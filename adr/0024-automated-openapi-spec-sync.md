# ADR-0024: Automated OpenAPI Spec Sync

**Status:** Accepted **Date:** 2026-10-30

Amends [ADR-0004](0004-openapi-specs-pulled-on-demand.md).

## Context

ADR-0004 made spec updates a manual step: someone with access to the private spec repository runs
`pull:update`, regenerates every consumer, and commits the result. CI never fetches specs.

In practice, the manual step ran only when someone needed a new type, so the generated types fell
behind the API. The upstream source also changed: `storyblok/openapi` replaces
`storyblok/openapi-wdx`. It publishes overlay-applied Content Delivery API and Management API specs
under `public/`, and the backend releases keep its source specs current.

## Decision

- **Pull from `storyblok/openapi`.** The codegen tool reads `public/v2/cdnapi.openapi.yaml` and
  `public/v1/mapi.openapi.yaml`. Everything else about ADR-0004 still holds: specs are fetched on
  demand into a git-ignored cache, pinned by `spec.lock`, and never committed.
- **A scheduled workflow syncs the specs.** `.github/workflows/openapi-sync.yaml` runs daily. It
  runs `pull:update` and stops when `spec.lock` doesn't move. Otherwise, it regenerates every
  consumer and opens or updates a single pull request.
- **The sync pull request includes the regenerated output, not only the lock.** A lock-only pull
  request shows reviewers nothing and can't merge until someone regenerates locally. With the output
  committed, CI type-checks and tests the new surface, and the diff shows what changed.
- **`pull:update` keeps the pinned SHA when the specs are unchanged.** The spec repository also
  holds overlays and tooling, so most of its commits leave the public specs untouched. Keeping the
  SHA stops those commits from opening empty sync pull requests.
- **A GitHub App authenticates the workflow.** One app token reads the private spec repository and
  opens the pull request. A pull request opened with the default `GITHUB_TOKEN` doesn't trigger CI.
- **The workflow leaves human work alone.** If the open sync pull request has commits from anyone
  else, for example fixes for consumers that no longer compile, the workflow skips the run instead
  of replacing the branch.

Pull request CI still never fetches specs. Only the sync workflow does, and it runs on `main` with
repository secrets, never on pull requests from forks.

## Consequences

- Generated types follow the API within a day of a spec change, without anyone remembering to
  regenerate.
- Each sync pull request needs a review. The workflow titles it `chore(tools): …`, which releases
  nothing. Reviewers retitle it to `feat` or `fix` when the generated diff changes a package's
  public surface.
- Upstream changes that break a consumer surface as a failing sync pull request instead of a
  surprise during unrelated work.
- An org admin must create the GitHub App, install it on both repositories, and add its ID and
  private key as repository secrets.

Links: DX-676.
