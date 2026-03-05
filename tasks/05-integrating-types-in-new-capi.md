# Part 5: Integrating Types in CAPI Client

Integrate `@storyblok/schema` types into `@storyblok/api-client` (`packages/capi-client`) so that consumers can get fully typed story content based on their component definitions, and optionally validate CAPI responses at runtime using Zod.

## Acceptance criteria

- `@storyblok/api-client` depends on `@storyblok/schema` via `workspace:*`.
- `stories.get()` and `stories.getAll()` accept an optional component type parameter so consumers can get typed story content (e.g., `stories.get<typeof pageComponent>(...)`).
- Story content returned by `stories.get()` is typed to `StoryContent<TComponent>` when a component type parameter is provided.
- The existing generated types (`StoryCapi`, `StoryContent`, `AssetField`, etc.) remain as the default/fallback when no component type is specified — backward compatibility is preserved.
- Optional `@storyblok/schema/zod` integration validates CAPI response payloads at runtime when enabled.
- `pnpm --filter @storyblok/api-client test:ci` passes.
- `pnpm --filter @storyblok/api-client build` succeeds.

---

## Context

`@storyblok/api-client` (published from `packages/capi-client/`) is a fully formed Content Delivery API client at version 0.1.0. Its current architecture:

- **Code generation**: Uses `@hey-api/openapi-ts` to generate typed clients from `@storyblok/openapi/dist/capi/*.yaml` specs. Six resource modules: stories, links, spaces, datasources, datasource-entries, tags.
- **HTTP client**: `ky`-based, configured via `createApiClient()` factory function.
- **Generated types**: Each resource has its own `types.gen.ts` with domain models (`StoryCapi`, `StoryContent`, `AssetField`, `MultilinkField`, `LinkCapi`, `SpaceCapi`, etc.).
- **Caching**: Three strategies (cache-first, network-first, SWR) with a pluggable `CacheProvider` interface and built-in in-memory LRU provider. Cache version (`cv`) tracking with auto-flush on change.
- **Rate limiting**: Token-bucket throttle with 4 tiers, auto-detected from request path and `per_page`. Adapts to `X-RateLimit-Policy` response header.
- **Relation inlining**: When `inlineRelations: true`, resolves `resolve_relations` by replacing UUID strings in content with full story objects, fetching additional stories via `rel_uuids` in batches of 50.
- **Tests**: 13 test files (~2000+ lines) using vitest + msw with OpenAPI-derived handlers.

The package currently defines its own content types derived from the CAPI OpenAPI specs. These types are accurate for the raw CAPI response shape but are not narrowed to specific component schemas — `StoryContent` is a generic object with `component: string` and open-ended fields. `@storyblok/schema` provides the type machinery to narrow these to specific components.

---

## What this task involves

### 5.1 Add `@storyblok/schema` dependency

Add `@storyblok/schema` as a dependency in `packages/capi-client/package.json`:

```json
{
  "dependencies": {
    "@storyblok/region-helper": "workspace:*",
    "@storyblok/schema": "workspace:*",
    "ky": "^1.14.3"
  }
}
```

Update the nx dependency chain so that `capi-client:build` depends on `@storyblok/schema:build`.

### 5.2 Add component-generic type parameter to story methods

Augment the existing `stories.get()` and `stories.getAll()` methods to accept an optional component type parameter. When provided, the returned story content is narrowed to the component's schema:

```ts
import type { Component, StoryContent } from '@storyblok/schema';

// Without component type — returns the existing loose StoryContent
const story = await client.stories.get({ identifier: 'home' });
// story.data.story.content is StoryCapi (generated, open-ended)

// With component type — returns typed content
const story = await client.stories.get<typeof pageComponent>({ identifier: 'home' });
// story.data.story.content is StoryContent<typeof pageComponent> (narrowed)
```

Implementation approach:
- Add a generic parameter `TComponent extends Component = Component` to the `stories.get()` and `stories.getAll()` return types.
- When `TComponent` is the default `Component`, the return type falls back to the existing generated `StoryCapi` type for backward compatibility.
- When a specific component type is provided, map the `content` field to `StoryContent<TComponent>` from `@storyblok/schema`.
- This is a **type-level only** change — no runtime behavior changes. The actual response data is the same; the type parameter just narrows what TypeScript sees.

### 5.3 Re-export shared types from `@storyblok/schema`

The `src/index.ts` currently exports prettified versions of generated types (`Story`, `Link`, `Space`, `Datasource`, `DatasourceEntry`, `Tag`). For the types that overlap with `@storyblok/schema` exports (`Story`, `Asset`, `Datasource`), decide on one of:

1. **Re-export from schema**: Replace the local type aliases with re-exports from `@storyblok/schema` where shapes match.
2. **Keep both**: Keep the CAPI-specific types (which match the raw API response) and add the schema types under different names (e.g., `TypedStory<TComponent>`).
3. **Augment**: Extend the CAPI types with the schema's generic parameter.

Option 3 (augment) is recommended — it preserves backward compatibility while adding the typed content capability. The CAPI `Story` type has fields specific to the CDN response (`cv`, `rels`, `rel_uuids`, etc.) that the schema `Story` type may not include.

### 5.4 Optional Zod runtime validation

Add an optional `validate` configuration option to `createApiClient()` that, when enabled, validates CAPI response payloads using `@storyblok/schema/zod`:

```ts
const client = createApiClient({
  accessToken: 'token',
  // When a component is passed to stories.get<TComponent>(),
  // validate the response content against the component schema at runtime.
  validate: true,
});
```

Implementation considerations:
- `@storyblok/schema/zod` requires `zod` as a peer dependency. Make this opt-in to avoid forcing all consumers to install `zod`.
- Validation should use `parseStory()` from `@storyblok/schema/zod` to validate the `content` field.
- On validation failure, either throw a `ZodError` or return it in the error field (depending on `throwOnError` config).
- This is a lower-priority enhancement — the type-level integration (5.2, 5.3) should land first.

### 5.5 Update tests

- Add type-level tests (`expectTypeOf`) verifying that `stories.get<typeof component>()` returns correctly narrowed types.
- Add runtime tests for the optional Zod validation path (mock a CAPI response, validate it against a component schema).
- Ensure all existing tests continue to pass unchanged (backward compatibility).

---

## Dependency

This task depends on Parts 1, 3, and 4 being complete (so `@storyblok/schema` exists with its types and Zod parsers).

## Coordination with Part 0

Part 0 (MAPI refactor) aligns the MAPI client with the CAPI's architecture:

- **Shared types become truly shared**: After Part 0, both MAPI and CAPI generate their story types from the same `story-base.yaml` + `story-content.yaml` shared specs. This means `@storyblok/schema`'s generated types will be structurally identical to both clients' generated types, making the type integration in 5.3 cleaner — the `StoryContent`, `AssetField`, `MultilinkField`, etc. types will match exactly.
- **Consistent API patterns**: Part 0 renames MAPI methods to match CAPI (`getAll`, `get`, `create`, `update`, `delete`) and switches to a factory function (`createManagementApiClient`). This means a future Part 6 could integrate `@storyblok/schema` types into the MAPI client using the same approach described here for the CAPI.
- **No blocking dependency**: Part 0 does not block this task, but if it lands first, the shared type story simplifies significantly.
