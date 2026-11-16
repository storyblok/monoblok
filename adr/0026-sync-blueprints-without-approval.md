# ADR-0026: Sync Blueprints Without Approval

**Status:** Accepted  
**Date:** 2026-11-11  
**Supersedes:** the approval parts of ADR-0023

## Context

ADR-0023 gated every blueprint sync behind an `approve` job with the `production` reviewers, and
`publish.yaml` starts a sync after every publish. The gate only mattered for the first sync, which
we rejected so we could run it by hand. Since then nobody has inspected a sync before approving it,
but people forget to approve: runs piled up, and a blueprint shipped late.

## Decision

**The sync runs without an approval.** The jobs are `matrix → stage → verify → push`, with the trust
boundaries of ADR-0023 unchanged. `push` keeps the `blueprint-sync` environment (App key, deploy
from `main`), and the sync no longer uses `production`. To stop it, disable the workflow in the
**Actions** tab.

## Consequences

- A publish on `main` reaches the templates without anyone acting, and no run blocks the queue.
- **No human gate on third-party dependencies.** `stage` pins whatever npm serves at sync time, and
  there's no release-age window yet (ADR-0023, known gaps), so the smoke test is the only thing
  between a malicious release and the public templates. The approval never caught that either.
- A person still approves the release that starts the sync, because `publish.yaml` runs under
  `production`. Manual runs work from `main` only.
- **A failed sync is silent.** GitHub emails a failed run only to the actor who started it, and a
  dispatched sync runs as `github-actions[bot]`. We accept that because the team checks the workflow
  runs and a template a few days out of date does no harm. If that changes, add alerting.
