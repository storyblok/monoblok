# Dependency timeline

What happens to a shared dependency when several SDKs are installed years apart.

The Docker matrix installs an app once, so it cannot show how a lockfile behaves as it grows. This
can. Three stand-in SDKs are built, each frozen at the version of `@storyblok/preview-bridge` that
was current when it shipped, and each declaring the caret range a real manifest would:

| SDK     | Built against | Declares |
| ------- | ------------- | -------- |
| `sdk-a` | 2.1.2         | `^2.1.2` |
| `sdk-b` | 2.1.6         | `^2.1.6` |
| `sdk-c` | 2.2.1         | `^2.2.0` |

Every SDK is built twice. The `bundled` flavor inlines the dependency, which is what Vite library
mode did before the migration, and still declares it in `package.json`. The `external` flavor leaves
it as a bare import, which is what `vp pack` does.

An app that uses all three is then installed three ways:

- `fresh`: one install with all three in `package.json`.
- `incremental`: one install per SDK, in order, on a growing lockfile.
- `timeline`: same, but each step also pins the bridge to the version that was current on that day
  and then drops the direct dependency, so the old resolution is carried in the lockfile rather than
  re-resolved.

Stand-ins are used rather than the real packages because only `@storyblok/js` bundles the bridge
today, so the real tree cannot produce three independently frozen copies. Everything else here is
real: real published bridge versions, a real bundler, real installs.

## Running

```sh
node --experimental-strip-types --no-warnings=ExperimentalWarning run.ts
node --experimental-strip-types --no-warnings=ExperimentalWarning run.ts --skip-build
```

Working files land in `.work/`, which is not committed.

## Counting copies

An inlined dependency keeps no version and no module identity, so copies are counted by searching
the build output for string literals that survive minification:

| Marker                        | Meaning                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| `storyblok-bridge-stylesheet` | the id of the style element the bridge injects, one per copy          |
| `fallbackLang`                | present from 2.1.6                                                    |
| `offsetWidth`                 | present until 2.2.0 moved overlay sizing to `getBoundingClientRect()` |
