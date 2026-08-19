# ADR-0014: Publish Workspace Dependencies as Caret Ranges

**Status:** Accepted  
**Date:** 2026-08-19

## Context

Packages in this repo reference each other with pnpm's `workspace:` protocol. `pnpm publish`
replaces that protocol at pack time, and the replacement depends on the specifier: `workspace:*`
becomes an **exact** version, `workspace:^` becomes a caret range.

Everything published so far used `workspace:*`. Three facts combine into a trap:

1. nx does not rewrite the specifier in the source manifest, so nothing in the repo shows what a
   tarball will actually carry.
2. `pnpm publish` freezes the dependency at whatever version the workspace happened to be at during
   that package's own publish moment.
3. `nx.json` sets `updateDependents: "never"`, so releasing a dependency does not release its
   dependents.

The pin therefore never refreshes on its own, and a consumer cannot receive a dependency patch until
every package in the chain is released again for unrelated reasons. At the time of this decision, 6
of 24 published runtime pins were already behind the versions on npm.

This is the mechanism that trapped `@storyblok/nuxt` 6.x users on the `cv=undefined` bug:
`@storyblok/nuxt@6.2.4` depended on `@storyblok/vue@^8.1.11`, which pinned `@storyblok/js@3.2.3`,
which pinned `storyblok-js-client@6.10.8` exactly. The fix shipped in `storyblok-js-client@6.10.11`,
but no install could reach it without a major SDK upgrade. A caret would have delivered it.

`@storyblok/preview-bridge` is the control case. It is the one Storyblok dependency that is not a
workspace package, it already used a caret, and it is the only one that stayed current on its own.

## Decision

**Runtime dependency sections of published packages use `workspace:^`. `devDependencies` keep
`workspace:*`.**

1. **`dependencies`, `peerDependencies`, and `optionalDependencies` of every published package use
   `workspace:^`**, so what reaches npm is a floor rather than a pin.
2. **`devDependencies` keep `workspace:*`.** Consumers never install them, so the range cannot reach
   anyone, and `*` remains the clearest way to say "whatever is in the workspace". Private
   playgrounds are unaffected for the same reason.
3. **`preserveLocalDependencyProtocols: true` is stated explicitly in `nx.json`.** It is nx's
   default since v21, but the entire scheme depends on it: were it false, `nx release version` would
   rewrite every `workspace:^` to a literal version inside a generated release commit that nobody
   reviews line by line.
4. **`pnpm check:workspace-protocol` enforces the split in CI.** `workspace:*` remains correct and
   common in `devDependencies`, which makes it the shape a contributor copies when adding a runtime
   dependency, and the mistake is invisible until the package is on npm.
5. **A package must not bundle a workspace dependency it declares with a range.** A caret range plus
   an inlined copy means the version that runs and the version that resolves can differ, so packages
   that declare a workspace dependency externalize it. Ordinary npm dependencies whose types are not
   part of the public surface are out of scope: bundling those is a build-size question, not a
   correctness one.

## Alternatives Considered

- **Keep `workspace:*` and rely on releasing dependents.** Rejected: this is the status quo, and it
  requires every dependent to be released whenever any dependency ships a fix. `updateDependents` is
  deliberately `"never"` here, so that release does not happen automatically.
- **Set `updateDependents: "auto"`.** This would refresh the pins by bumping dependents on every
  dependency release. Rejected: it trades a stale-pin problem for a release-noise problem, cutting
  releases of packages that did not change, and it still leaves consumers pinned between those
  releases.
- **Write literal ranges (`^6.3.1`) in the manifests instead of using the workspace protocol.**
  Rejected: it breaks local linking, since pnpm would resolve from the registry rather than the
  workspace, and it puts a version number in the source manifest that has to be maintained by hand.
- **Use `workspace:~` instead.** Rejected: it delivers patches but not minors, which is a narrower
  guarantee than these packages intend, given that features are routinely additive minors here.

## Consequences

- **Published dependency versions become floors.** A consumer without a lockfile can resolve a newer
  Storyblok dependency than the SDK was tested against. That is the standard caret bargain, accepted
  here because we control both sides of it, but it is a real change: the exact pin was in effect a
  tested-together guarantee.
- **The caret is narrower than it looks on `0.x`.** `^0.7.1` allows `>=0.7.1 <0.8.0`, so for
  `@storyblok/api-client`, `@storyblok/management-api-client`, `@storyblok/live-preview`, and
  `@storyblok/schema`, only patches flow and a minor still requires releasing the dependent. This
  affects `@storyblok/angular`, `@storyblok/migrations`, and `storyblok`, and resolves itself as
  those packages reach 1.0.
- **Pre-release channels lose the exact-build guarantee.** A range built from a pre-release version,
  such as `^7.8.0-next.0`, also matches stable `7.8.0` and `7.9.0`, so an artifact published from a
  pre-release branch can resolve a stable dependency instead of the pre-release it was built
  against. This is accepted rather than solved, on the grounds that pre-release consumers are
  already opted into instability and the alternatives (per-branch overrides, publish-time channel
  checks) cost more than the risk. RELEASING.md documents the condition and the per-edge escape
  hatch.
- **The alpha-only failure mode changes shape.** It previously failed loudly on an exact version
  that was never published. A range fails the same way when nothing satisfies it, but resolves
  quietly to a different version when something does, which is harder to notice. The `pnpm release`
  guard that catches accidental bumps of alpha-only packages therefore still matters.
- **Nothing reaches npm until each package is released for its own reasons.** Adopting the protocol
  bumps no versions by itself, so the fix arrives package by package. It repairs nothing for anyone
  currently stuck on a frozen pin, because published manifests are immutable. It stops the next one.
- **Some packages had to start externalizing their workspace dependencies.** `@storyblok/vue` and
  `@storyblok/astro` inlined `@storyblok/js`, `@storyblok/richtext`, and `storyblok-js-client` into
  their bundles while declaring ranges for them, which rule 5 above forbids. For `@storyblok/vue`
  this also means its UMD build expects those dependencies as globals, matching what `@storyblok/js`
  already did.
