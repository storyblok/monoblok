# Part 4: Integrating Types in CAPI Client

Integrate `@storyblok/schema` types into `@storyblok/api-client` (`packages/capi-client`) so that consumers can pass a Schema type to `createApiClient` and get fully typed, discriminated story content from `stories.get()` and `stories.getAll()`.

## Target developer experience

```ts
import { createApiClient } from '@storyblok/api-client';
import type { Component, StoryContent } from '@storyblok/schema';

// 1. Define components using @storyblok/schema helpers
const pageComponent = defineComponent({
  name: 'page',
  schema: {
    headline: defineProp(defineField({ type: 'text' })),
    body: defineProp(defineField({ type: 'richtext' })),
  },
  // ... other required component metadata
});

const heroComponent = defineComponent({
  name: 'hero',
  schema: {
    title: defineProp(defineField({ type: 'text' })),
    image: defineProp(defineField({ type: 'asset' })),
  },
  // ...
});

// 2. Define a Schema as a union of components
type Schema = typeof pageComponent | typeof heroComponent;

// 3. Pass Schema to createApiClient
const client = createApiClient<Schema>({
  accessToken: 'test-token',
});

// 4. stories.get() returns discriminated content
const result = await client.stories.get('home');
// result.data.story.content is:
//   StoryContent<typeof pageComponent> | StoryContent<typeof heroComponent>
// i.e., discriminated by content.component: 'page' | 'hero'

if (result.data?.story.content.component === 'page') {
  result.data.story.content.headline; // string (narrowed)
}
```

## Acceptance criteria

- `@storyblok/api-client` depends on `@storyblok/schema` via `workspace:*`.
- `createApiClient<Schema>()` accepts an optional Schema generic parameter (a union of `Component` types) that flows through to story response types.
- `stories.get()` and `stories.getAll()` return story content typed as a discriminated union of `StoryContent<T>` for each component `T` in the Schema.
- Content is discriminated by `content.component`, so narrowing with `if (content.component === 'page')` works.
- When no Schema generic is provided, the return type falls back to the existing loose `StoryCapi` type — backward compatibility is preserved.
- Existing `ThrowOnError` and `InlineRelations` generics continue to work alongside Schema.
- `pnpm --filter @storyblok/api-client test:ci` passes.
- `pnpm --filter @storyblok/api-client build` succeeds.

---

## Context

### `@storyblok/api-client` (capi-client) current state

- **Entry point**: `createApiClient<ThrowOnError, InlineRelations>(config)` factory in `src/index.ts`.
- **Stories resource**: `createStoriesResource<InlineRelations>(deps)` in `src/resources/stories.ts`. Methods:
  - `stories.get(identifier, options?)` — `identifier` is `string | number`, returns `ApiResponse<GetResponse<InlineRelations>, ThrowOnError>`.
  - `stories.getAll(options?)` — returns `ApiResponse<GetAllResponse<InlineRelations>, ThrowOnError>`.
- **Generated types**: `StoryCapi` (extends `StoryBase`) and `StoryContent` in `src/generated/stories/types.gen.ts`. `StoryContent` has `component: string` and an open index signature — no narrowing.
- **Story type branching**: `StoryResult<InlineRelations>` resolves to `StoryWithInlinedRelations` or `StoryCapi` based on the `InlineRelations` flag.
- **No dependency on `@storyblok/schema`** — the two packages are currently unconnected.

### `@storyblok/schema` current state

- **`Component<TName, TSchema>`** — generic type capturing a literal component name and its typed schema (record of `Prop` entries). Defined in `src/types/component.ts`.
- **`StoryContent<TComponent>`** — mapped type that produces `{ component: TComponent['name']; _uid?: string } & { [K in keyof TComponent['schema']]: FieldTypeValueMap[...] }`. Defined in `src/types/story.ts`.
- **`Story<TComponent>`** — `Omit<story_capi, 'content'> & { content: StoryContent<TComponent> }`. Defined in `src/types/story.ts`.
- **`FieldTypeValueMap`** — maps field type discriminants (`'text'`, `'number'`, `'asset'`, etc.) to runtime value types (`string`, `number`, `AssetField`, etc.). Defined in `src/types/field.ts`.
- **Helper functions**: `defineComponent()`, `defineField()`, `defineProp()`, `defineStory()` — identity functions that preserve literal types for inference.

The key insight: `@storyblok/schema` already provides the full type machinery (`Component`, `StoryContent`, `Story`) needed to produce narrowed content types. The task is to thread a Schema generic (a union of `Component` types) through capi-client so that `stories.get()` and `stories.getAll()` return the correctly discriminated union.

---

## What this task involves

### 4.1 Add `@storyblok/schema` dependency

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

### 4.2 Add Schema generic to `createApiClient`

Add a `Schema` generic parameter to the factory function. Schema is a **union of Component types** that represents all components in the consumer's Storyblok space:

```ts
import type { Component } from '@storyblok/schema';

export const createApiClient = <
  Schema extends Component = Component,
  ThrowOnError extends boolean = false,
  InlineRelations extends boolean = false,
>(
  config: ContentApiClientConfig<ThrowOnError, InlineRelations>,
) => {
  // ... existing implementation unchanged
  // Pass Schema through to createStoriesResource
  const stories = createStoriesResource<Schema, InlineRelations>({
    ...resourceDeps,
    inlineRelations,
  });
  // ...
};
```

When `Schema` is the default `Component` (i.e., the consumer didn't provide a type), story methods fall back to the existing loose `StoryCapi` type. When a specific union is provided, content types are narrowed.

### 4.3 Thread Schema through story resource types

Update `createStoriesResource` and its return types to incorporate the Schema generic:

```ts
import type { Component, StoryContent as SchemaStoryContent, Story as SchemaStory } from '@storyblok/schema';

// Conditional: if Schema is narrower than Component, use schema-derived types.
// Otherwise fall back to generated StoryCapi.
type StoryResult<Schema extends Component, InlineRelations extends boolean> =
  Component extends Schema
    ? (InlineRelations extends true ? StoryWithInlinedRelations : StoryCapi)  // fallback
    : SchemaStory<Schema>;  // narrowed

type GetResponse<Schema extends Component, InlineRelations extends boolean> = Omit<GetResponses[200], 'story'> & {
  story: StoryResult<Schema, InlineRelations>;
};

type GetAllResponse<Schema extends Component, InlineRelations extends boolean> = Omit<GetAllResponses[200], 'stories'> & {
  stories: Array<StoryResult<Schema, InlineRelations>>;
};
```

The discriminated union works because `SchemaStory<Schema>` where `Schema = A | B` distributes to `SchemaStory<A> | SchemaStory<B>`, and each variant has a unique literal `content.component` value (`'page'` or `'hero'`), enabling TypeScript narrowing.

The method signatures gain the Schema parameter:

```ts
export function createStoriesResource<
  Schema extends Component = Component,
  InlineRelations extends boolean = false,
>(deps: StoriesResourceDeps) {
  return {
    get: async <ThrowOnError extends boolean = false>(
      identifier: StoryIdentifier,
      options?: { ... },
    ): Promise<ApiResponse<GetResponse<Schema, InlineRelations>, ThrowOnError>> => {
      // ... implementation unchanged
    },
    getAll: async <ThrowOnError extends boolean = false>(
      options?: { ... },
    ): Promise<ApiResponse<GetAllResponse<Schema, InlineRelations>, ThrowOnError>> => {
      // ... implementation unchanged
    },
  };
}
```

This is a **type-level only** change — no runtime behavior changes. The actual response data is the same; the Schema parameter narrows what TypeScript sees.

### 4.4 Export Schema-related types

Re-export the schema types that consumers need alongside the client:

```ts
// In src/index.ts
export type { Component, StoryContent, Story as TypedStory } from '@storyblok/schema';
```

Keep the existing `Story` export (which is `Prettify<StoryCapi>`) as-is for backward compatibility. The schema's `Story<T>` can be exported as `TypedStory<T>` or consumers can import it directly from `@storyblok/schema`.

### 4.5 Handle `InlineRelations` + Schema interaction

When both `inlineRelations: true` and a Schema are provided, the inlined relations content should still respect the Schema types. Consider:

- **Option A**: When Schema is provided and InlineRelations is true, produce `SchemaStory<Schema>` (ignore InlineRelations for typing, since schema types already describe the content shape).
- **Option B**: Create a `StoryWithInlinedRelations<Schema>` that uses Schema-narrowed content but allows nested story objects in relation fields.

Option A is simpler and recommended for the initial implementation. The `bloks` field type in `FieldTypeValueMap` already maps to `StoryContentGenerated[]`, which handles nested content.

### 4.6 Update tests

- Add **type-level tests** (`expectTypeOf`) verifying:
  - `stories.get()` without Schema returns `StoryCapi`.
  - `stories.get()` with a Schema union returns a discriminated union of `Story<T>` types.
  - `content.component` narrowing works correctly.
  - Backward compatibility: existing test code compiles unchanged.
- Ensure all existing runtime tests continue to pass.

---

## Non-goals for this task

- **Zod runtime validation** of CAPI responses: Deferred. The `@storyblok/schema/zod` subpath is scaffolded but empty. Runtime validation can be added in a follow-up once the Zod schemas are wired up.
- **Per-method component type parameter** (e.g., `stories.get<typeof pageComponent>(...)`): The Schema-on-client approach is preferred because it types all stories at once based on the full space schema, enabling discriminated unions. Per-method overrides could be added later if needed.

## Dependency

This task depends on Parts 1, 2, and 3 being complete (so `@storyblok/schema` exists with its `Component`, `StoryContent`, and `Story` types).
