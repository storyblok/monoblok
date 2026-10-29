# ADR-0022: Fix CJS Node-Mode Interop

**Status:** Accepted. **Date:** 2026-10-29

## Context

The packages are `"type": "module"` and ship both ESM and CommonJS builds. The CJS build is produced
by rolldown, which treats every import in the source as Node ESM and emits `dep = __toESM(dep, 1)`
after `var dep = require("dep")`, or `dep = require_runtime.__toESM(dep, 1)` when the helper is
shared across chunks. The `1` (node mode) ignores `__esModule` and sets `.default` to the whole
exports object. That is wrong for output loaded with `require()`:

- `ky` is ESM-only. On Node 22+ `require("ky")` already returns a namespace with `__esModule` and
  the function on `.default`, which the flag wraps a second time.
- `storyblok-js-client` and `@tiptap/extension-*` set `__esModule` and export their value as
  `exports.default`, which the flag hides.

The result was a broken CJS build: `kyInstance is not a function` on the first request in
`@storyblok/api-client` and `@storyblok/management-api-client`,
`storyblok_js_client.default is not a constructor` in `@storyblok/js`, and
`default.extend is not a function` in the `@storyblok/richtext` parsers.

Rolldown chooses the mode from the importing source module, not from the output format, and has no
option to change it. rolldown/rolldown#10308 and #10800 were closed as intended behavior;
`output.interop` is tracked in rolldown/rolldown#7704.

## Decisions

### 1. Rewrite node mode out of external imports with a shared plugin

A rolldown plugin (`tools/cjs-interop-plugin.ts`) rewrites `__toESM(x, 1)` to `__toESM(x)` in CJS
and UMD chunks. The pattern matches only an identifier argument, so it touches imports of external
dependencies. Bundled CommonJS dependencies are emitted as `__toESM(require_dep(), 1)`, a call, and
keep node mode, so the CJS build agrees with the ESM build for them. The ESM build is unchanged.

The plugin is temporary. Remove it once rolldown ships `output.interop`.

### 2. Apply it to every package that ships CJS

Only some packages hit the bug, but the plugin runs on all of them. A dependency added later would
otherwise fail the same way, and nobody notices a broken `require()` until a user does. For the
packages that did not break, the output is unchanged or differs only in how an already-working
default import is wrapped, so applying the plugin there releases none of them.

### 3. Test against the built CJS entry

A regression test has to `require()` the built output, because the bug exists only there. The
`module-format` tests load the package's CommonJS entry and call into it, for example a real request
through `ky` or a parse through `@tiptap/extension-*`. They fail without the plugin and pass with
it.

## Alternatives Considered

- **Wait for `output.interop` in rolldown.** Rejected: there is no date for it, and the CJS build is
  broken for users in the meantime.
- **Ask rolldown to change the behavior.** Rejected: the existing issues were closed as intended.
- **Apply the plugin only to the packages that broke.** Rejected: see decision 2.

## Consequences

- **The two builds can still disagree for one kind of dependency.** For an external dependency, the
  CJS and ESM builds agree only while the dependency ships an ESM entry. A CommonJS-only dependency
  that sets `__esModule` gets `exports.default` in the CJS build, while the ESM build's default
  import is `module.exports` under Node semantics. No current dependency is like that, but the
  plugin runs on every package, so check it before adding one.
- **The plugin is a build input of every package.** A change to it invalidates the nx build cache.
- **The plugin matches rolldown's output text.** After a rolldown upgrade, check that the shape
  above is still what it emits, or the rewrite silently stops applying. The `module-format` tests
  catch that.
