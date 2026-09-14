# ADR-0015: pnpm Supply Chain Hardening

**Status:** Accepted  
**Date:** 2026-09-14

## Context

The npm registry attacks of 2025 (`chalk`/`debug`, then the self-replicating Shai-Hulud worm) all
shared the same shape: a maintainer account is taken over, a patch version is published, and every
consumer that installs within the next few hours executes the payload through an install lifecycle
script. The malicious versions were typically unpublished within hours, so the exposure window was
short but the blast radius was everything that ran `install` during it.

This repo installs hundreds of transitive dependencies, and CI installs them on every push with
credentials in the environment. Three properties of our setup made us a soft target:

1. Any dependency could run arbitrary code at install time. `onlyBuiltDependencies` listed the two
   we wanted built, but a newly introduced package with a lifecycle script was silently skipped
   rather than surfaced — nobody reviewed the change.
2. Nothing stopped us from installing a version published minutes ago.
3. Nothing noticed if a package that previously shipped with npm provenance suddenly stopped — the
   exact signal a hijacked publishing pipeline produces.

## Decision

Adopt the three controls pnpm ships for this, all in `pnpm-workspace.yaml`:

- **`strictDepBuilds: true`** — an unreviewed lifecycle script fails the install instead of being
  skipped with a warning. Every package that may run one is in `onlyBuiltDependencies`; every
  package we deliberately do not build is in `ignoredBuiltDependencies`. A new entry in either list
  is a reviewable diff.
- **`minimumReleaseAge: 1440`** — no version published in the last 24 hours is installable. This is
  the single highest-value control: it converts "published minutes ago" from an exposure into a
  non-event, because a compromised release is normally pulled well inside that window.
- **`trustPolicy: no-downgrade`** — a version whose publish attestation is weaker than one we
  already resolved fails the install. Losing provenance is a hijack signature, not a routine
  release.

## Consequences

- A dependency that starts running install scripts blocks the install until someone classifies it.
  That is the point; resolve it by adding the package to the correct list, not by relaxing the
  setting.
- A freshly published version — including our own packages — cannot be consumed for 24 hours. When a
  genuine emergency needs a newer one, add a scoped, commented entry to `minimumReleaseAgeExclude`
  rather than lowering the global value.
- `trustPolicyExclude` exists for legitimate downgrades (a maintainer handover, a CI migration off
  provenance). Each entry needs a comment naming the reason.
- Requires a pnpm that knows these settings; the `packageManager` pin (10.27) does.
