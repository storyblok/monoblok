---
title: "CommonJS Deprecation"
description:
  "The CommonJS builds of the Storyblok JavaScript packages are deprecated. Learn how to find where
  one loads, how to move to ESM, and how to silence the warning."
---

{/* target: src/content/docs/docs/libraries/js/commonjs-deprecation.mdx (new page; add a "CommonJS
Deprecation" entry after "Region Helper" in src/config/navigation/libraries.ts) */}

import { Aside } from "@astrojs/starlight/components";

The CommonJS builds of the Storyblok JavaScript packages are deprecated and will be removed in the
next major version of each package. When a CommonJS build loads, the package prints a deprecation
warning:

```text
(node:12345) [STORYBLOK_CJS_DEPRECATED] DeprecationWarning: The CommonJS build of "@storyblok/js" was loaded (through require() or a CommonJS toolchain). CommonJS builds of Storyblok packages are deprecated and will be removed in the next major version; use ESM instead. Set STORYBLOK_SILENCE_CJS_DEPRECATION=1 to silence this warning.
```

The warning changes nothing else. `require()` returns the same exports as before.

## Affected packages

The warning applies to every package that ships a CommonJS build:

- `@storyblok/accessibility-checker`
- `@storyblok/api-client`
- `@storyblok/experiments`
- `@storyblok/js`
- `@storyblok/live-preview`
- `@storyblok/management-api-client`
- `@storyblok/migrations`
- `@storyblok/react`
- `@storyblok/region-helper`
- `@storyblok/richtext`
- `@storyblok/schema`
- `@storyblok/vue`
- `storyblok-js-client`

The warning prints once per process, and once more in every worker thread, however many of these
packages load. It names the first one that loaded. A package that another package depends on can
trigger it, for example `@storyblok/region-helper` through `@storyblok/api-client`. Test runners
that give every test file its own environment print it once per file, see
[Test runners](#test-runners).

## Find where the CommonJS build loads

The build loads when your code calls `require()` on the package. It also loads when a CommonJS
toolchain runs your `import` statements, such as Jest in its default mode, ts-node with
`module: commonjs`, or a tool that reads the `main` field of `package.json`.

To find the caller, run Node.js with `--trace-deprecation`. If the stack trace ends inside the
Node.js loader, raise the limit with `--stack-trace-limit=50`:

```shell
node --trace-deprecation --stack-trace-limit=50 app.js
```

## Move to ESM

Use `import` instead of `require()`:

```js
import { renderRichText } from "@storyblok/richtext";
```

Until the CommonJS builds are removed, `require()` loads the CommonJS build and prints the warning.
After the removal, `require()` can load the ESM build on Node.js 20.19, 22.12, and later versions,
as long as the package has no top-level `await`. Code that can't move to `import` can keep calling
`require()` then.

## Silence the warning

Silence the warning while you migrate with one of the following:

- Run Node.js with `--disable-warning=STORYBLOK_CJS_DEPRECATED`. Node.js 20.11, 21.3, and later
  versions support the flag. Earlier versions refuse to start with it.
- Set the `STORYBLOK_SILENCE_CJS_DEPRECATION` environment variable to any non-empty value. Any
  non-empty value silences the warning, including `0` and `false`.

<Aside type="caution">
  `--throw-deprecation` turns every deprecation warning into an uncaught error. `require()` returns
  normally, so a `try/catch` around it doesn't catch the error. The process then exits with code 1
  on the next tick. Silence the warning with the environment variable to avoid the crash.
</Aside>

### Test runners

A test runner that gives every test file its own environment, such as Jest, prints the warning once
per test file. Set `STORYBLOK_SILENCE_CJS_DEPRECATION` in the test environment to silence it.

### Deno

Deno asks for permission before a script reads an environment variable. The package only checks
`STORYBLOK_SILENCE_CJS_DEPRECATION` when the permission is already granted, so the package never
triggers a prompt. Without the permission, Deno doesn't print the warning.
