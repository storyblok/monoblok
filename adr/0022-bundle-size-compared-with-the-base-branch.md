# ADR-0022: Bundle Size Compared With the Base Branch

**Status:** Accepted  
**Date:** 2026-10-26

## Context

Package size needs a CI guard that covers every package and every entry point, and flags growth
relative to what is already shipped.

Two approaches fell short. Committed per-package baselines had to be updated by hand on every
intended change, so most PRs that touched a package also touched its baseline, and the diff that
mattered was buried in it. size-limit checks each listed entry against a static limit: an entry
nobody lists goes unchecked, and a limit set with headroom lets a package grow into it unnoticed.

## Decision

On every PR, CI builds the PR and its base branch in parallel and measures both with the PR's
`monoblok size measure`, so both builds are measured the same way. The base branch is the baseline:
nothing is committed.

Every package under `packages/` is measured unless it never reaches a browser. Each export is
bundled the way a consumer's bundler would: with its dependencies and theirs, minified and gzipped,
leaving out peer dependencies the app provides and chunks that load lazily. Every published file is
also measured on its own. Growth of more than both 5% and 100 B fails. The `bundle-size-accepted`
label turns failing growth into a warning.

The entry size is the up-front cost of importing an export: what every page that uses it downloads
before it runs. Lazily loaded chunks still reach the browser, but later and only when their feature
runs, so adding them would blur that cost, and moving code into a lazy chunk, which improves the
initial load, would not show. A package's own lazy chunks are still covered by the per-file check.

## Consequences

- New packages and entry points are covered without setup, and there is no baseline to maintain.
- Every PR builds twice. The base build runs in parallel with the PR's, so PRs take no longer, but
  CI uses more runner minutes.
- Growth below the threshold is never flagged, so a package can creep up across many PRs. The PR
  comment shows every change, which keeps it visible.
- Sizes include dependencies, so a change in one package shows up in every package that depends on
  it, as it does for their users. Measuring a build needs that build's own `node_modules`, so the
  compare job installs the base branch as well.
- Lazily loaded dependencies, such as the preview bridge or `axe-core`, are not measured. A separate
  report of lazy chunks can be added if one becomes a problem.
- Files are matched across builds by path, so chunk file names must not carry a content hash.
