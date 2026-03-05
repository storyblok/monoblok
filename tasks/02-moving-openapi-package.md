# Part 2: Moving OpenAPI Package

## Context

`@storyblok/openapi` is currently a private internal package (`"private": true`) that lives at `packages/openapi/`. It holds both Management API (MAPI) and Content API (CAPI) OpenAPI 3.1.1 specs. The CAPI specs are already in active use by `@storyblok/api-client` (`packages/capi-client`), which generates its typed client from `@storyblok/openapi/dist/capi/*.yaml`.

The plan is for `@storyblok/schema` to supersede `@storyblok/openapi` as the public-facing package, exposing the bundled OpenAPI YAML files under a `./openapi/*` subpath export so consumers can reference them directly:

```ts
import mapiSpec from '@storyblok/schema/openapi/mapi.yaml';
import capiSpec from '@storyblok/schema/openapi/capi.yaml';
```

## What this task will involve

- Move or re-export the bundled YAML files from `packages/openapi/dist/` into `packages/schema/` (either by including `@storyblok/openapi` as a dependency and forwarding its dist files, or by physically moving the source YAML specs into `packages/schema/`).
- Add `./openapi/*` wildcard subpath exports to `packages/schema/package.json`.
- Update `tsdown.config.ts` to handle YAML passthrough (tsdown does not process YAML — this may require a copy step in the build script or a Vite/Rollup YAML plugin).
- Update `generate.ts` to locate YAML specs relative to the package itself rather than via `@storyblok/openapi`.
- Mark `@storyblok/openapi` as deprecated and update any consumers (`@storyblok/management-api-client`, `@storyblok/api-client`) to use the new path.
- Update nx dependency chain accordingly.

## Dependency

This task depends on Part 1 being complete (so `@storyblok/schema` exists with its build infrastructure and subpath exports).

## Coordination with Part 0

Part 0 (MAPI refactor) restructures the MAPI OpenAPI specs to use shared `$ref` paths (e.g., `allOf` with `shared/stories/story-base.yaml`), renames files (e.g., `blok.yaml` is replaced by shared `story-content.yaml`), and may consolidate some `mapi/shared/` files with global `shared/` files. If Part 0 lands before this task:

- The file paths being moved will differ from the current layout. Verify which files exist under `packages/openapi/resources/` before planning the move.
- The `mapi/shared/responses.yaml` may no longer exist (replaced by a ref to `shared/responses.yaml`).
- Both `@storyblok/management-api-client` and `@storyblok/api-client` are consumers that need updating when the OpenAPI package path changes. After Part 0, the MAPI client will also reference CAPI-shared specs, making the deprecation path cleaner.
