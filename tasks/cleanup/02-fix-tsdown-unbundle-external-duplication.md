# Cleanup 02: Fix tsdown Unbundle External Duplication

Both `packages/capi-client` and `packages/mapi-client` use `tsdown` with
`unbundle: true` and generate per-resource `client/` and `core/` directories from
`@hey-api/openapi-ts`. Due to how code generation works, each resource directory
gets its own copy of the identical boilerplate (ky client, utils, serializers,
etc.). This inflates the mapi-client `dist/` to ~3.5 MB, of which ~2.5 MB is
duplicated boilerplate code.

The `mapi-client` already attempted to fix this with `external` patterns in
`tsdown.config.ts`, but the patterns do not match actual import specifiers and
have no effect. This task identifies the correct fix and applies it to both
packages.

## Acceptance criteria

- The mapi-client `dist/` size is reduced from ~3.5 MB to roughly the amount of
  unique code (shared `client/` + `core/` emitted once rather than 11 times).
- The capi-client `dist/` shows the same improvement if it has the same
  duplication (verify first — it has fewer generated resources so the impact may
  be smaller).
- Both packages build, test, lint, and typecheck cleanly after the change.
- Published package still works correctly for consumers (imports resolve).

---

## Context

### How `unbundle: true` works

With `unbundle: true`, tsdown (rolldown) emits one output file per input source
file instead of bundling everything into a single chunk. This is useful for
tree-shaking and for preserving the module structure in the published package.

### The duplication

`@hey-api/openapi-ts` generates per-resource directories, each containing:

```
src/generated/<resource>/
  client.gen.ts        — re-exports from client/
  sdk.gen.ts           — the SDK functions
  types.gen.ts         — TypeScript types
  client/
    client.gen.ts      — ky client factory (identical across all resources)
    index.ts
    types.gen.ts       — identical
    utils.gen.ts       — identical
  core/
    auth.gen.ts        — identical
    bodySerializer.gen.ts — identical
    params.gen.ts      — identical
    pathSerializer.gen.ts — identical
    serverSentEvents.gen.ts — identical
    utils.gen.ts       — identical
```

The `client/` and `core/` files are **byte-for-byte identical** across all
resources (only the `#region` source comment differs). With `unbundle: true`, each
of these is emitted as a separate file in `dist/`, creating ~11 copies of the same
~230 KB of boilerplate.

### Why the existing `external` patterns in `mapi-client` don't work

```ts
external: [
  './src/generated/*/client/*',
  './src/generated/*/core/*',
],
```

tsdown/rolldown matches `external` against **resolved module IDs** (the full
absolute path or the specifier string as it appears in `import` statements), not
against source-relative glob patterns. The generated files import using relative
specifiers like `'./client'` and `'../core/utils.gen'`, which never match these
globs. The patterns are silently ignored.

---

## Investigation: Correct approach

Before implementing, determine which of these approaches is correct for the
tsdown/rolldown version in use. Check the tsdown and rolldown documentation or
source for how `external` patterns are resolved in `unbundle` mode:

1. **Absolute path globs**: Use absolute paths or resolved module IDs in the
   `external` array instead of source-relative paths.
2. **`external` as a function**: tsdown may support `external: (id) => boolean`.
   A function that returns `true` for paths containing `/generated/*/client/` or
   `/generated/*/core/` would correctly identify these files.
3. **Generate shared client/core once**: Change the code generation script to
   generate `client/` and `core/` only once (in a shared location like
   `src/generated/shared/`) and update all per-resource `client.gen.ts` files
   to import from the shared location. This is a generation-time fix rather than
   a build-time fix.
4. **Single entry point**: Since the package already has a single `src/index.ts`
   entry, consumers only import from the package root and never directly import
   per-resource files. It may be possible to use `unbundle: false` (bundle mode)
   for the generated code, or to use tsdown's `noExternal`/`external` correctly
   to deduplicate at link time.

**Recommendation**: Option 3 (generate shared client/core once) is the most
robust because it fixes the duplication at its source. However, it requires
changes to both `generate.ts` scripts and possibly to the `@hey-api/openapi-ts`
configuration. Option 2 (function-based `external`) is the quickest fix if
tsdown supports it — verify first.

---

## Implementation

### Step 1: Verify the fix approach

Check whether tsdown's `external` option accepts a function predicate:

```ts
// tsdown.config.ts experiment
export default defineConfig({
  // ...
  external: (id: string) => id.includes('/generated/') && (id.includes('/client/') || id.includes('/core/')),
});
```

Build with this config and inspect `dist/` to confirm whether the duplication is
eliminated. If it is, adopt this approach for both packages.

If function-based `external` does not work, fall back to Option 3 (modify
`generate.ts` to emit shared client/core).

### Step 2: Apply to mapi-client

Remove the broken glob-based `external` patterns from
`packages/mapi-client/tsdown.config.ts` and replace with the working approach
found in Step 1.

### Step 3: Apply to capi-client

Examine `packages/capi-client/dist/` to measure its duplication. The capi-client
has 6 generated resource directories (stories, links, tags, spaces, datasources,
datasource-entries), so the duplication is smaller than mapi-client's 11
directories but still present. Apply the same fix.

`packages/capi-client/tsdown.config.ts` currently has no `external` config at all.
Add the correct configuration.

### Step 4: Verify build output

After the fix:
- Count unique files in `dist/generated/*/client/` and `dist/generated/*/core/`.
  In the ideal case, each distinct file (e.g., `utils.gen.js`) exists exactly once
  shared across all resources, or each resource's copy is properly externalized and
  resolves to a single shared copy.
- Confirm `dist/` size reduction.
- Run a smoke test: import the package in a test script and verify resource methods
  work correctly.

### Step 5: Run checks

```sh
pnpm --filter @storyblok/api-client build
pnpm --filter @storyblok/api-client test:ci
pnpm --filter @storyblok/api-client lint
pnpm --filter @storyblok/management-api-client build
pnpm --filter @storyblok/management-api-client test:ci
pnpm --filter @storyblok/management-api-client lint
```
