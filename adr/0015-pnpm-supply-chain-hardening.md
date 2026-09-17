# ADR-0015: pnpm Supply Chain Hardening

**Status:** Accepted  
**Date:** 2026-09-14

## Context

The npm registry attacks of 2025 (`chalk`/`debug`, then the self-replicating Shai-Hulud worm) all
shared the same shape: a maintainer account is taken over, a patch version is published, and every
consumer that installs within the next few hours executes the payload through an install lifecycle
script. The malicious versions were typically unpublished within hours, so the exposure window was
short but the blast radius was everything that ran `install` during it.

This repo installs hundreds of transitive dependencies. Three properties of our setup made us a soft
target:

1. Any dependency could run arbitrary code at install time. `onlyBuiltDependencies` listed the two
   we wanted built, but a newly introduced package with a lifecycle script was skipped with a
   non-blocking warning that nobody acted on, so the change never reached review.
2. Nothing stopped us from resolving a version published minutes ago into the lockfile.
3. Nothing noticed if a package that previously shipped with npm provenance suddenly stopped, which
   is the exact signal a hijacked publishing pipeline produces.

## Decision

Adopt the three controls pnpm ships for this, all in `pnpm-workspace.yaml`:

- **`strictDepBuilds: true`**: an unreviewed lifecycle script fails the install instead of being
  skipped with a warning. Every package that may run one is in `onlyBuiltDependencies`; every
  package we deliberately do not build is in `ignoredBuiltDependencies`. A new entry in either list
  is a reviewable diff.
- **`minimumReleaseAge: 1440`**: no version published in the last 24 hours can be resolved. This is
  the single highest-value control: it converts "published minutes ago" from an exposure into a
  non-event, because a compromised release is normally pulled well inside that window.
- **`trustPolicy: no-downgrade`**: a version whose publish attestation is weaker than that of any
  earlier-published version of the same package fails to resolve. Losing provenance is a hijack
  signature, not a routine release.

### Where each control acts

`strictDepBuilds` acts on every install, including CI's `pnpm install --frozen-lockfile`.

`minimumReleaseAge` and `trustPolicy` act only when pnpm resolves a version against registry
metadata, so they run on the machine that updates the lockfile (`pnpm add`, `pnpm update`, a
non-frozen install) and not on a frozen install of an existing lockfile. CI therefore does not
re-check a version that is already in `pnpm-lock.yaml`. The control point for those two settings is
the contributor who updates the lockfile plus review of the lockfile diff. pnpm 11 is expected to
re-verify the lockfile on frozen installs; revisit this section when the pin moves.

## Alternatives Considered

- **`allowBuilds` instead of `onlyBuiltDependencies` + `ignoredBuiltDependencies`.** pnpm 11
  deprecates the two lists in favor of a single `allowBuilds` map. Rejected for now: on 10.27.0,
  `allowBuilds` entries set to `false` still fail `pnpm install --frozen-lockfile` with
  `ERR_PNPM_IGNORED_BUILDS`, so only the two-list form works with `strictDepBuilds` at the pinned
  version. Migrate when the `packageManager` pin moves to 11.
- **A lower `minimumReleaseAge`.** Rejected: the 2025 incidents were pulled within hours, but not
  within minutes, and the cost of waiting a day for a third-party patch is low.
- **Relying on CI to enforce the resolution-time checks.** Not possible on pnpm 10; see above.

## Consequences

- A dependency that starts running install scripts fails the install with `ERR_PNPM_IGNORED_BUILDS`.
  pnpm's hint suggests `pnpm approve-builds`, which defaults to allowing the script. Do not follow
  it blindly. The default classification is `ignoredBuiltDependencies`
  (`pnpm approve-builds '!<pkg>'`, or edit the list); move a package to `onlyBuiltDependencies` only
  when the workspace demonstrably needs the build output. Never resolve it by relaxing
  `strictDepBuilds`.
- A freshly published third-party version cannot be resolved for 24 hours. Our own packages
  reference each other with `workspace:^`, which is exempt, so a release never blocks local
  development. The one Storyblok dependency pulled from the registry is `@storyblok/preview-bridge`,
  so a bridge fix needed by an SDK release the same day waits or needs a scoped entry in
  `minimumReleaseAgeExclude`. Never exclude `@storyblok/*` wholesale: those are exactly the packages
  a hijack of this org's npm account would target.
- `trustPolicy` compares against every earlier-published version, not against a version this repo
  resolved before. A first-time `pnpm add` can fail with `ERR_PNPM_TRUST_DOWNGRADE` when a
  maintainer once shipped provenance and later stopped. For that case use `trustPolicyIgnoreAfter`
  (pnpm 10.27+), which ignores trust evidence older than a given date, before reaching for
  `trustPolicyExclude`. The latter is for a permanent, legitimate downgrade (maintainer handover, CI
  migration off provenance). Each entry in either setting needs a comment naming the reason.
- Requires a pnpm that knows these settings; the `packageManager` pin (10.27) does.
