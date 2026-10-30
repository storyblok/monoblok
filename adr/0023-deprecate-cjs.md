# ADR-0023: Deprecate CJS

**Status:** Accepted. **Date:** 2026-10-29

## Context

The packages are `"type": "module"` and ship both ESM and CommonJS builds. We want to stop shipping
CJS. ESM is the module system of the platform, `require(esm)` is available in current Node releases,
and a dual build doubles the surface that has to be tested and kept correct. The node-mode interop
bug ([ADR-0022](0022-fix-cjs-node-mode-interop.md)) is an example: it broke the CJS build of four
packages and was invisible in the ESM one.

CJS consumers still exist, and so do plain JavaScript users who never see a type declaration, so
removal needs a warning period that reaches both.

## Decisions

### 1. Keep fixing breakage in the CJS build until it is removed

A CJS build that throws on first use is a regression for the people still on it, however briefly it
is supported. The scope is bounded: we fix issues that break the CJS build or make it disagree with
ESM, as in ADR-0022. We do not add features or workarounds that exist only for CJS.

### 2. Drop CJS in favor of ESM in the next major versions

CJS is deprecated as of this ADR and will not be part of the next major version of each package. The
removal drops the `require` condition and the `.cjs` output from `exports`. Consumers that cannot
move to `import` have `require(esm)` on Node versions that support it, provided the package has no
top-level `await`.

### 3. Signal the deprecation with a runtime warning, not with TypeScript `@deprecated`

The CJS entry emits a `DeprecationWarning` through `process.emitWarning`, with a stable `code`,
naming the first package that loaded and the removal in the next major version. It fires once per
realm across all Storyblok packages rather than once per package, so a dependency chain such as
`@storyblok/js` through `@storyblok/api-client` produces one line, not one per package. A realm is
the main thread, a worker thread or a test context, so each of those warns once. The warning never
throws: a runtime without `process` or `process.env` loads the package as usual.

It is silenced with Node's `--disable-warning=<code>` (Node.js 20.11 and 21.3 or later; older
versions refuse to start with it), or with an environment variable set to any non-empty value, for
toolchains where the flag is not reachable and on older Node versions.

The warning ships in a minor release, not a major one. It changes no API and no behavior of the
package: `require()` returns the same exports as before, and a line on stderr is the only effect.
The one way it can stop a run is `--throw-deprecation`, which users opt into, and which turns every
`DeprecationWarning` into an uncaught error. A major would only delay the notice, and consumers need
the warning before the removal, not with it. The crash under that flag goes into the release notes.

We evaluated tagging the CJS type declarations (`.d.cts`) with `@deprecated` and rejected it:

- **It is too noisy.** TypeScript reads the tag per declaration, so every imported symbol, type and
  interface in every file that uses the package is struck through. A file-level comment does
  nothing.
- **It has false positives.** `package.json` points `types` at `./dist/index.d.cts`, so consumers on
  legacy `moduleResolution: node` resolve to the `.d.cts` even when they write `import` and bundle
  to ESM. They would see a CJS deprecation without running the CJS build.
- **It does not reach JavaScript users.** Plain JS consumers, who exist in numbers, never load a
  declaration file, and they are exactly the people a `require()` in an old script or config file
  belongs to.

A runtime warning fires only when the CJS build is actually loaded, whatever language the caller is
written in. It can still reach someone who writes `import` but runs a CommonJS toolchain, such as
Jest in its default mode, ts-node with `module: commonjs`, or a tool that reads `main`. So the
message says how the build was loaded, not that the caller wrote a `require()`.

## Alternatives Considered

- **`@deprecated` on the `.d.cts` types.** Rejected: see decision 3. It was prototyped on one
  package. tsdown generates the `.d.cts` in a separate pass that excludes user plugins, so it
  requires a `build:done` hook that rewrites the emitted files, which is more machinery than the
  signal is worth.
- **Keeping the guard in a built-in module such as `util`, to warn once per worker instead of once
  per test file.** Rejected: it mutates an object that is shared with the rest of the process and
  still warns once per worker, so it trades a little noise for a global side effect.
- **Tagging only value exports, or only the entry points.** Rejected: it reduces the noise but not
  the false positives for `moduleResolution: node` consumers, and it does not reach JS users.
- **`npm deprecate`.** Rejected: it works per package version, not per module format, so it would
  flag ESM users too.
- **Remove CJS now.** Rejected: it is a breaking change, and a deprecation period gives consumers a
  release to react to.
- **Stop fixing CJS bugs immediately.** Rejected: see decision 1.

## Consequences

- **CJS consumers see a runtime warning** when the CJS build loads, in a release before the major,
  and can silence it while they migrate. `require()` still returns normally, so a `try/catch` around
  it sees nothing. With `--throw-deprecation`, the process then crashes on the next tick with exit
  code 1 and only the environment variable avoids it.
- **A deprecation notice and a migration note go into the changelog and the docs** with the first
  release that ships the warning. The docs page is staged in the PR that adds the warning and moves
  to the docs platform before that PR merges. The changelog entry comes from the commit subject, so
  the squash-merge title has to say that the CJS build is deprecated.
- **Until the major ships, the CJS build keeps being built and tested.** The warning plugin is a
  build input of every package, like the interop plugin, so a change to it invalidates the nx build
  cache.
- **The warning ships to every package that has a CJS build**, including the transitive ones, so a
  consumer such as a framework that `require`s a package will emit it on behalf of its users. The
  once-per-realm guard keeps that to a single line. Test runners that give every test file its own
  realm, such as Jest, print it once per file, which the environment variable silences.
- **The CLI is the exception.** Its only CJS build is the `storyblok/config` entry, which config
  loaders such as ts-node and Jest `require` on behalf of a user who never wrote the call, so a
  warning there would reach people who cannot act on it.
- **The `types` field still resolves to `.d.cts`.** Fixing that is a separate change to the package
  `exports` and is not part of this decision.
