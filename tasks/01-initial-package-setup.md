# Part 1: Initial Package Setup

Create the `packages/schema` package with all build infrastructure, code generation pipeline, and empty source stubs that validate the full toolchain works end-to-end before any real logic is written.

## Acceptance criteria

- `pnpm --filter @storyblok/schema generate` reads OpenAPI specs from `@storyblok/openapi` and writes files to `src/generated/`
- `pnpm --filter @storyblok/schema build` produces a `dist/` folder with correct subpath exports (`.`, `./zod`)
- `pnpm --filter @storyblok/schema test:types` passes
- `pnpm --filter @storyblok/schema test:unit:ci` passes (even if there are no test cases yet)
- `pnpm --filter @storyblok/schema lint` passes

---

## 1.1 `package.json`

**Path:** `packages/schema/package.json`

```json
{
  "name": "@storyblok/schema",
  "version": "0.0.1",
  "type": "module",
  "description": "Storyblok schema types, helpers, and Zod parsers",
  "license": "MIT",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./zod": {
      "import": {
        "types": "./dist/zod/index.d.ts",
        "default": "./dist/zod/index.js"
      },
      "require": {
        "types": "./dist/zod/index.d.cts",
        "default": "./dist/zod/index.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "generate": "tsx generate.ts",
    "build": "tsdown",
    "test:unit": "vitest",
    "test:unit:ci": "vitest run",
    "test:types": "tsc --noEmit --skipLibCheck",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "peerDependencies": {
    "zod": "^3.x"
  },
  "peerDependenciesMeta": {
    "zod": {
      "optional": true
    }
  },
  "devDependencies": {
    "@storyblok/eslint-config": "workspace:*",
    "@storyblok/openapi": "workspace:*",
    "openapi-zod-client": "latest",
    "tsdown": "latest",
    "tsx": "latest",
    "typescript": "^5.8.3",
    "vitest": "latest",
    "zod": "^3.x"
  },
  "nx": {
    "targets": {
      "generate": {
        "dependsOn": ["^build"],
        "inputs": [
          "{projectRoot}/generate.ts",
          "{projectRoot}/templates/**",
          { "externalDependencies": ["openapi-zod-client"] }
        ],
        "outputs": ["{projectRoot}/src/generated"]
      },
      "build": {
        "dependsOn": ["generate", "^build"]
      }
    }
  }
}
```

Notes:
- The `./openapi/*` subpath export is intentionally omitted here — it belongs to Part 5 (moving the openapi package).
- `zod` is a `peerDependency` (optional) so users only need it when importing `@storyblok/schema/zod`. It is also listed under `devDependencies` so the package can test against it.
- `tsx` is used to run `generate.ts` without a prior compile step.

---

## 1.2 `tsconfig.json`

**Path:** `packages/schema/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "generate.ts"]
}
```

---

## 1.3 `tsdown.config.ts`

**Path:** `packages/schema/tsdown.config.ts`

Two separate entry points are required because `./zod` has a peer dependency on `zod` and must be tree-shakeable from the zero-dep main entry.

```ts
import { defineConfig } from 'tsdown';

const sharedConfig = {
  clean: true,
  dts: true,
  sourcemap: true,
  attw: true,
  publint: true,
  external: ['zod'],
};

export default [
  defineConfig({
    ...sharedConfig,
    entry: { index: './src/index.ts' },
    outDir: './dist',
    format: ['esm', 'cjs'],
  }),
  defineConfig({
    ...sharedConfig,
    entry: { 'zod/index': './src/zod/index.ts' },
    outDir: './dist',
    format: ['esm', 'cjs'],
  }),
];
```

Notes:
- `external: ['zod']` ensures zod is never bundled, respecting the peer dependency contract.
- Splitting ESM and CJS into the same `defineConfig` call is fine here because we do not have UMD targets. If `.d.mts` splitting issues arise (as with `richtext`), split into separate configs per format.
- `clean: true` only on the first config entry, or handle it manually; having two configs both set `clean: true` will cause the second to wipe the first's output. Adjust as needed during implementation.

---

## 1.4 `vitest.config.ts`

**Path:** `packages/schema/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

---

## 1.5 `eslint.config.js`

**Path:** `packages/schema/eslint.config.js`

Follow the pattern used by other packages (e.g., `packages/richtext/eslint.config.js`):

```js
import storyblok from '@storyblok/eslint-config';

export default storyblok();
```

Check what the exact export shape of `@storyblok/eslint-config` is before writing this — other packages in the repo serve as the reference.

---

## 1.6 `generate.ts` — Code generation script

**Path:** `packages/schema/generate.ts`

This script is the bridge between the `@storyblok/openapi` YAML specs and the package's auto-generated source files. It runs as a pre-build step (via the `generate` nx target).

### What it does

1. Locates the `@storyblok/openapi` package path using `pnpm --filter @storyblok/openapi list --json` (same approach as `packages/mapi-client/generate.ts` and `packages/capi-client/scripts/generate.ts`).
2. Globs the relevant bundled YAML files from its `dist/` folder:
   - `dist/mapi/stories.yaml`
   - `dist/mapi/components.yaml`
   - `dist/mapi/datasources.yaml`
   - `dist/mapi/assets.yaml`
   - `dist/capi/stories.yaml`
3. Cleans `src/generated/` (remove all files before regenerating).
4. For each YAML file, calls `openapi-zod-client` programmatically using `generateZodClientFromOpenAPI` with:
   - A custom Handlebars template (`templates/schemas-only.hbs`) that outputs **only** Zod schemas and TypeScript types — no Zodios HTTP client, no endpoints array.
   - `--export-schemas` equivalent option to export all `#/components/schemas`.
   - `--export-types` to generate TypeScript interfaces alongside Zod schemas.
   - `--strict-objects` for `.strict()` on all object schemas.
   - `--with-description` to carry over OpenAPI descriptions as `z.describe()` annotations.
5. Writes output to:
   - `src/generated/types.ts` — aggregated TypeScript types from all relevant schemas
   - `src/generated/zod-schemas.ts` — aggregated Zod schemas from all relevant schemas

### Post-processing

The raw `openapi-zod-client` output may need transformation for two known issues:

- **`additionalProperties: true` schemas** (e.g., `Component.schema`, `StoryContent`/`Blok`): These map to `z.record(z.string(), z.any())` which is too loose. Add a post-processing step to replace or annotate these with the discriminated-union field schema from `src/zod/schemas/field-schema.ts` (written in Part 3) once available. Note: After Part 0 (MAPI refactor), the MAPI spec will use the shared `story-content.yaml` instead of the simpler `blok.yaml`, so the generated schema name will be `StoryContent` (matching the CAPI output).
- **`ComponentSchemaField.type` is `z.string()`** (no enum in OpenAPI): Post-process to replace with `z.enum([...all field types...])`.

### Rough skeleton

```ts
import { execSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateZodClientFromOpenAPI } from 'openapi-zod-client';

// 1. Locate @storyblok/openapi
const result = JSON.parse(
  execSync('pnpm --filter @storyblok/openapi list --json', { encoding: 'utf-8' })
);
const openapiPkgPath = result[0].path;

// 2. Clean generated dir
rmSync('./src/generated', { recursive: true, force: true });
mkdirSync('./src/generated', { recursive: true });

// 3. Generate from each YAML
const specs = [
  { path: resolve(openapiPkgPath, 'dist/mapi/stories.yaml'), name: 'mapi-stories' },
  { path: resolve(openapiPkgPath, 'dist/mapi/components.yaml'), name: 'mapi-components' },
  { path: resolve(openapiPkgPath, 'dist/mapi/datasources.yaml'), name: 'mapi-datasources' },
  { path: resolve(openapiPkgPath, 'dist/mapi/assets.yaml'), name: 'mapi-assets' },
  { path: resolve(openapiPkgPath, 'dist/capi/stories.yaml'), name: 'capi-stories' },
];

for (const spec of specs) {
  await generateZodClientFromOpenAPI({
    openApiDoc: spec.path,
    distPath: `./src/generated/${spec.name}.ts`,
    templatePath: './templates/schemas-only.hbs',
    options: {
      exportSchemas: true,
      withDescription: true,
      strictObjects: true,
    },
  });
}
```

Adjust the exact API call signature based on the installed version of `openapi-zod-client`. Refer to its documentation and source for the correct programmatic interface.

---

## 1.7 `templates/schemas-only.hbs`

**Path:** `packages/schema/templates/schemas-only.hbs`

A custom Handlebars template for `openapi-zod-client` that strips out all HTTP client / endpoint / Zodios-related output and emits only:
- Zod schema variable declarations (one per `#/components/schemas` entry)
- A named `export` for each schema
- Optionally, TypeScript type aliases derived from the schemas (`z.infer<typeof X>`)

Start by copying the `schemas-only.hbs` example from the `openapi-zod-client` repository (check the `example/` directory in its source) and trim it down. If no official schemas-only template exists, use the default template as a base and remove the endpoint/api sections.

The output file should look like:

```ts
// Auto-generated. Do not edit manually.
import { z } from 'zod';

export const Story = z.object({ ... });
export type Story = z.infer<typeof Story>;

export const Component = z.object({ ... });
export type Component = z.infer<typeof Component>;

// ... etc.
```

---

## 1.8 Source file stubs

Create the minimum source files so the build succeeds without errors:

**`packages/schema/src/index.ts`**
```ts
// Types and define helpers (zero runtime dependencies)
// Populated in Part 2
export {};
```

**`packages/schema/src/zod/index.ts`**
```ts
// Zod schemas and parse helpers (requires zod peer dependency)
// Populated in Part 3
export {};
```

**`packages/schema/src/generated/.gitkeep`**
An empty file to ensure the directory is tracked by git before the first `generate` run.

---

## 1.9 `.gitignore`

**Path:** `packages/schema/.gitignore`

```
dist/
src/generated/*.ts
node_modules/
```

Keep `.gitkeep` but ignore generated `.ts` files inside `src/generated/`.

---

## Integration with nx

After creating the package, verify that nx picks it up:

```sh
pnpm nx show project @storyblok/schema
```

The `generate` → `build` dependency chain should appear in the project graph:

```sh
pnpm nx graph
```

Verify the full chain:
```
@storyblok/openapi:build → @storyblok/schema:generate → @storyblok/schema:build
```

---

## Known constraints from the monorepo

- `.npmrc` has `link-workspace-packages=false` — workspace packages resolve via the registry protocol, not symlinks. The `@storyblok/openapi` devDependency uses `workspace:*` which pnpm resolves correctly regardless.
- `@storyblok/openapi` is `"private": true` — it will never be published, but it works fine as a `workspace:*` devDependency within the monorepo.
- The nx `build` target for all packages caches by default. Generated files in `src/generated/` are outputs of the `generate` target, so they must be declared in the nx `outputs` array to ensure cache invalidation works correctly.
- **Part 0 coordination**: If Part 0 (MAPI refactor) is completed before or in parallel with this task, the MAPI YAML specs in `@storyblok/openapi` will have a different structure (using `allOf` with shared `story-base.yaml`, shared field-type schemas, etc.). The generated output from `openapi-zod-client` may produce different schema names and structures. Verify the generated output against the updated bundled specs after Part 0 lands.
