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

Every package under `packages/` is measured unless it is listed as never reaching a browser. Each
gets three gzipped measurements of its published `dist` files: each `exports` target plus the files
it statically imports from the package, the total per format, and every file on its own. Growth
fails when it is past both a percentage and a byte floor, so small files don't fail on a few bytes.
CommonJS is reported but never fails. The `bundle-size-accepted` label turns failing growth into a
warning.

## Consequences

- New packages and entry points are covered without setup, and there is no baseline to maintain.
- Every PR builds twice. The base build runs in parallel with the PR's, so PRs take no longer, but
  CI uses more runner minutes.
- Growth below the thresholds is never flagged, so a package can creep up across many PRs. The PR
  comment shows every change, which keeps it visible.
- Sizes exclude dependencies, so each package's change shows up under that package, not under every
  package that depends on it.
- Files are matched across builds by path, so chunk file names must not carry a content hash.
