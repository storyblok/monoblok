# ADR-0013: Adopt Vite+ as the Unified Toolchain

**Status:** Accepted **Date:** 2026-08-10

## Context

Every package answered the same questions differently.

**Bundling** was `tsdown` in nine projects (the API clients, `richtext`, `schema`, `migrations`,
`live-preview`, `experiments`, `openapi-codegen`), `unbuild` in three (`cli`, `region-helper`,
`tools/monoblok`), and `vite build` in four (`js`, `react`, `vue`, `astro`). Angular, Nuxt, and
Svelte used the builder their framework dictates (`ng build`, `nuxt-module-build`,
`svelte-package`).

**Testing** was Vitest, configured through a per-project `vitest.config.ts` in ten projects and
folded into `vite.config.ts` in the others, with the same handful of options repeated each time.

**Linting** was ESLint through `@storyblok/eslint-config`, which wrapped `@antfu/eslint-config` and
pulled a plugin per ecosystem: `eslint-plugin-vue`, `eslint-plugin-svelte`, `eslint-plugin-astro`,
`eslint-plugin-cypress`, `@nuxt/eslint`. Eighteen projects carried an `eslint.config.*` file.

**Formatting was not enforced at all.** No project had a `format` script, and there was no
repo-level formatter config. What remained was residue: `prettier` as a devDependency in four
packages (`astro`, `nuxt`, `region-helper`, `richtext`), a `.prettierrc` in `region-helper`, a
`prettier` block in `packages/angular/package.json`, and `eslint-config-prettier` in three packages
to switch off rules that would have conflicted with a formatter nothing ran. Formatting was
therefore whatever each contributor's editor did, which is why style varied file to file.

Script names had drifted along with the configs. The same intent appeared as `test`, `test:unit`, or
`test:unit:ci`; watch mode as `dev`, `build:watch`, or `test:watch`; coverage as `coverage` or
`test:coverage`. `nx run-many --target=test` therefore ran a different subset than anyone expected,
and adding a package meant copying whichever neighbour happened to be closest.

## Decision

**Adopt [Vite+](https://viteplus.dev) (the `vp` CLI) as the single entry point for bundling,
testing, linting, and formatting, and standardize script names on one vocabulary.**

1. **One tool per job, one config file.** `vp pack` / `vp build` bundle, `vp test` runs Vitest,
   `vp lint` runs Oxlint, `vp fmt` runs Oxfmt. A package's `vite.config.ts` holds all of it, so the
   per-package `tsdown.config.ts`, `vitest.config.ts`, and `eslint.config.*` files are gone.
2. **Framework builders stay where Vite+ does not apply.** Angular keeps `ng build`, Nuxt keeps
   `nuxt-module-build`, Svelte keeps `svelte-package`. Those toolchains own their output formats,
   and replacing them is a separate decision from unifying everything else.
3. **Oxlint replaces ESLint, via `@storyblok/lint-config`.** The new package exports a `base` preset
   plus per-framework subpaths, mirroring what `@storyblok/eslint-config` did. That package is
   removed rather than deprecated: leaving two lint configs in the tree is what caused the drift.
4. **Formatting becomes an enforced step.** Oxfmt via `vp fmt`, checked in CI. This is a new
   guarantee rather than a replacement, since nothing previously formatted the repo.
5. **Canonical script vocabulary.** `build`, `dev` (watch-build), `lint`, `lint:fix`, `test`,
   `test:watch`, `test:ui`, `test:unit`, `test:e2e`, `test:e2e:watch`, `test:types`,
   `test:coverage`. Every package that can support a name uses that name and no synonym.
6. **Formatting is owned by the repo root, not by packages.** `vp fmt` reads the `fmt` key of the
   Vite+ config in its own working directory and does not search parent directories, so a
   per-package `vp fmt` silently falls back to Oxfmt's defaults. The root `vite.config.ts` is the
   only formatter config, `pnpm format` formats the whole repo, and CI checks it once. Packages have
   no `format` script.
7. **Generated and vendored files are excluded from formatting.** `**/src/generated/` and
   `tools/openapi-codegen/specs/` are listed in `.prettierignore`, matching what every
   `oxlint.config.ts` already ignores. The generators and `spec.lock` own those files; formatting
   them would drift on the next regeneration or `pull`.
8. **Oxfmt and Oxlint are pinned to the versions Vite+ pins.** `vite-plus` depends on exact `oxfmt`
   and `oxlint` versions. The repo declares those same exact versions, so the binary a developer or
   editor resolves is the one `vp` runs.
9. **Linting is per project; the root run only covers what no project owns.** Repo config, the
   release scripts, and agent scripts had no linter before. The root `oxlint.config.ts` ignores
   `packages/` and the project directories under `tools/`, so those files are linted once, by their
   own project, with their own preset and ignores. The root run invokes `oxlint` directly rather
   than `vp lint`: `vp lint` resolves every workspace project itself and disregards the root ignore
   list, and Oxlint needs `--disable-nested-config` there, since it otherwise loads every nested
   `oxlint.config.ts` before any ignore pattern applies.

## Alternatives Considered

- **Unify the script names and leave the tooling alone.** Rejected: it fixes the `nx run-many`
  problem and none of the duplication, and it still leaves formatting unenforced. The script drift
  was a symptom of every package owning its own tooling.
- **Adopt Oxlint and Oxfmt directly, without Vite+.** This was the closest alternative. It avoids
  depending on a pre-1.0 tool for the whole pipeline, but it keeps a bundler config and a test
  config per package, which is most of what this ADR exists to delete. Vite+ also fronts tools we
  would be adopting anyway: its dependencies pin `vitest`, `oxlint`, and `oxfmt` directly, so the
  lock-in is narrower than a new CLI suggests.
- **Wire up Prettier properly instead of adopting Oxfmt.** Rejected: it would mean keeping a
  separate formatter toolchain next to Oxlint when `vp fmt` already ships one, and the Prettier
  residue in the tree was config nobody ran rather than a setup worth preserving.
- **Biome for lint and format.** Rejected on scope: it would cover linting and formatting but
  neither the bundler nor the test runner, so the per-package config duplication would remain.
- **A shared formatter config imported by each package's `vite.config.ts`.** Rejected: it preserves
  per-package `format` scripts at the cost of a relative import reaching out of every package, and
  four projects have no Vite+ config at all. Root-owned formatting needs no such import.

## Consequences

- **Lint is meaningfully faster.**
  `nx run-many --target=lint --exclude="@storyblok/playground-*" --skip-nx-cache`, 20 projects,
  three runs on one machine: 11s / 9s / 10s on Oxlint against 18s / 16s / 16s on ESLint, so roughly
  10s against 16.7s, a ~40% reduction and less run-to-run spread. This is local wall-clock for the
  lint target only, not total CI time.
- **Oxlint does not cover every rule ESLint did.** Some `@antfu/eslint-config` and
  `@storyblok/eslint-config` rules have no Oxlint equivalent yet; `packages/lint-config/src/base.ts`
  lists them as comments so the intent stays visible. Part of the speed gain is less work, not a
  faster engine.
- **Oxlint's type-aware rules see more than the previous setup did**, which surfaced a real defect:
  an `import` inside a `declare namespace` in `@storyblok/astro` (TS1147).
- **Vitest moves from 3 to 4**, since that is what Vite+ pins. Vitest 4 invokes mock implementations
  with `new`, so mocks that returned from an arrow function had to become function expressions.
- **`test`, `test:types`, and `test:coverage` now depend on `^build` in `nx.json`.** With
  `injectWorkspacePackages`, pnpm copies a dependency into its consumers and only refreshes that
  copy after the dependency's `build` runs, so without `^build` these targets raced the sync and
  failed intermittently in the integration-test playgrounds.
- **A formatting pass touches nearly every file once**, because nothing formatted the repo before.
  It is isolated in its own commit so the toolchain change stays reviewable.
- **Markdown prose is now hard-wrapped** at the print width (`proseWrap: "always"`), so authors keep
  writing paragraphs as single long lines and the formatter places the line breaks.
- **Vite+ is young and pre-1.0.** The version is pinned in `.viteplus-version`, which CI installs,
  so an upstream change cannot arrive unannounced. The escape hatch is that each `vp` subcommand
  fronts a tool that can be run directly.
