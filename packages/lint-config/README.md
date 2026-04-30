# @storyblok/lint-config

Shared [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) configuration for the Storyblok ecosystem. Designed to be used together with [Vite+](https://viteplus.dev) (`vp lint`), but works with any Oxlint-compatible runner.

This package supersedes [`@storyblok/eslint-config`](https://npmjs.com/package/@storyblok/eslint-config), which is now deprecated. See [Migration](#migration) below.

## Install

```bash
pnpm add -D @storyblok/lint-config oxlint
```

## Usage

Configs are exported as TypeScript objects produced with Oxlint's `defineConfig`. Compose them via the `extends` field of your own `oxlint.config.ts`:

```ts
// oxlint.config.ts — plain TS / JS projects
import { defineConfig } from "oxlint";
import { base } from "@storyblok/lint-config";

export default defineConfig({
  extends: [base],
});
```

> **Note:** Oxlint's `extends` resolves only relative paths in JSON configs. Importing presets via TypeScript (as shown above) is the supported way to consume this package.

### Framework presets

| Preset                     | When to use it                         |
| -------------------------- | -------------------------------------- |
| `base` (or default export) | Default. Plain TS / JS libraries.      |
| `vue`                      | Projects with `.vue` SFCs.             |
| `svelte`                   | Projects with `.svelte` files.         |
| `astro`                    | Projects with `.astro` files.          |
| `nuxt`                     | Nuxt apps and modules (extends `vue`). |

```ts
// oxlint.config.ts — a Nuxt project
import { defineConfig } from "oxlint";
import { nuxt } from "@storyblok/lint-config";

export default defineConfig({
  extends: [nuxt],
});
```

Each preset is also available as a subpath import if you only want one:

```ts
import nuxt from "@storyblok/lint-config/nuxt";
```

### Run

If you use Vite+:

```bash
vp lint
```

Or invoke Oxlint directly:

```bash
pnpm dlx oxlint
```

## Known gaps vs. `@storyblok/eslint-config`

Oxlint does not yet have full plugin parity with ESLint. The following rules from the previous `@storyblok/eslint-config` have **no equivalent** in Oxlint at the time of writing and are intentionally omitted:

- All `vue/*` stylistic rules (`vue/max-attributes-per-line`, `vue/singleline-html-element-content-newline`, `vue/html-self-closing`, `vue/object-property-newline`) — handled by `vp fmt` (Oxfmt).
- `vue/multi-word-component-names`, `vue/no-multiple-template-root` — no Oxlint equivalent yet.
- `style/function-call-spacing` and other `@stylistic/*` rules — handled by `vp fmt`.
- `antfu/top-level-function`, `perfectionist/sort-imports` — third-party ESLint plugins with no Oxlint port.

If any of these matter to your project, keep `eslint` configured alongside Oxlint and run both — `vp lint` will not fail because of missing rules.

## Migration

If you were using `@storyblok/eslint-config`:

```diff
- // eslint.config.ts
- import { storyblokLintConfig } from '@storyblok/eslint-config';
- export default storyblokLintConfig();
```

```diff
+ // oxlint.config.ts
+ import { defineConfig } from 'oxlint';
+ import { base } from '@storyblok/lint-config';
+ export default defineConfig({ extends: [base] });
```

Then update your `package.json`:

```diff
  "scripts": {
-   "lint": "eslint .",
-   "lint:fix": "eslint . --fix"
+   "lint": "vp lint",
+   "lint:fix": "vp lint --fix"
  },
- "devDependencies": {
-   "@storyblok/eslint-config": "^0.5.0",
-   "eslint": "^9.0.0"
- }
+ "devDependencies": {
+   "@storyblok/lint-config": "^0.1.0",
+   "oxlint": "^0.15.0"
+ }
```

## License

MIT — see [LICENSE](./LICENSE).
