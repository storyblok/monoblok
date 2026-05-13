# `@storyblok/schema` Reference

`@storyblok/schema` is Storyblok's shared schema layer. It exports TypeScript types and `define*` helpers for authoring Storyblok content shapes (components, fields, stories, datasources, and more) in code.

## Requirements

This package is compatible with Node.js 18 and above.

This package ships as ES modules with CommonJS fallbacks.

This package is framework agnostic and can be used in any TypeScript project.

## Installation

```bash
npm i @storyblok/schema
```

## Example

A minimal schema declaration with `@storyblok/schema`:

```ts
import {
  defineBlock,
  defineBlockFolder,
  defineDatasource,
  defineField,
  type Schema as InferSchema,
} from '@storyblok/schema';

const layoutFolder = defineBlockFolder({ name: 'Layout' });

const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: [
    defineField('headline', { type: 'text', required: true }),
    defineField('image', { type: 'asset', filetypes: ['images'] }),
  ],
});

const colorsDatasource = defineDatasource({ name: 'Colors', slug: 'colors' });

export const schema = {
  blocks: { heroBlock },
  blockFolders: { layoutFolder },
  datasources: { colorsDatasource },
};

export type Schema = InferSchema<typeof schema>;
```

## Usage

The package exposes typed factories and types (`define*` helpers) for components, fields, stories, datasources, presets, assets, links, tags, internal tags, users, and spaces.

Names follow a convention. CDN (Content Delivery API) helpers use the bare name (`defineStory`). MAPI (Management API) helpers use the `Mapi` prefix where a CDN counterpart exists (`defineMapiStory`). MAPI-only entities keep the bare name (`defineBlockFolder`).

### defineBlock()

```ts
defineBlock(component)
defineBlockCreate(component)
defineBlockUpdate(component)
```

Returns a typed component (block) definition. The literal types in `name` and `schema` are preserved so downstream helpers such as `defineStory` can narrow the content shape.

```ts
import { defineBlock, defineField } from '@storyblok/schema';

export const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  schema: [
    defineField('title', { type: 'text', required: true }),
    defineField('body', { type: 'bloks' }),
  ],
});
```

`defineBlock()` accepts every property exposed by Storyblok's component MAPI schema. The most common ones:

| Property | Description |
| --- | --- |
| `name` | The technical name of the component. |
| `display_name` | Optional human-readable name shown in the Storyblok UI. |
| `is_root` | Marks the component as a content type (root block). |
| `is_nestable` | Marks the component as nestable inside `bloks` fields. |
| `component_group_uuid` | UUID of the block folder this component belongs to. |
| `schema` | An array of field definitions (typically produced by `defineField()`). |

`defineBlockCreate()` and `defineBlockUpdate()` narrow the shape to what the MAPI accepts for creation and update payloads respectively.

### defineField()

```ts
defineField(name, definition)
```

Returns a typed field definition keyed by its `name`. The `type` discriminates the accepted properties. For example, an `asset` field accepts `filetypes`, while a `text` field accepts `max_length`.

```ts
import { defineField } from '@storyblok/schema';

const headlineField = defineField('headline', { type: 'text', max_length: 120 });
const imageField = defineField('image', { type: 'asset', filetypes: ['images'] });
```

The package also exports type-level helpers for working with field values: `FieldType`, `FieldValue`, `FieldValueInput`, `AssetFieldValue`, `BlocksFieldValue`, `MultilinkFieldValue`, `PluginFieldValue`, `RichtextFieldValue`, `TableFieldValue`, `BlockContent`, and `BlockContentInput`.

### defineBlockFolder()

```ts
defineBlockFolder(folder)
defineBlockFolderCreate(folder)
defineBlockFolderUpdate(folder)
```

Returns a typed block (component) folder definition. The helper auto-assigns a stable `uuid` derived from the folder's `name`, so components can reference the folder via `component_group_uuid` before the folder exists remotely.

```ts
const layoutFolder = defineBlockFolder({ name: 'Layout' });
```

### defineDatasource() and defineDatasourceEntry()

```ts
defineDatasource(datasource)
defineDatasourceCreate(datasource)
defineDatasourceUpdate(datasource)

defineDatasourceEntry(entry)         // CDN shape
defineMapiDatasourceEntry(entry)     // MAPI shape
defineDatasourceEntryCreate(entry)
defineDatasourceEntryUpdate(entry)
```

`defineDatasource()` declares a datasource by `name` and `slug`. The entry helpers declare individual datasource entries. Use the CDN variant when working with `storyblok-js-client` responses and the MAPI variant when working with the Management API.

### defineStory() and defineMapiStory()

```ts
defineStory(component, story)
defineMapiStory(component, story)
defineStoryCreate(component, story)
defineStoryUpdate(component, story)
```

Returns a typed story whose `content` is narrowed to the passed component. `defineStory()` produces the CDN-shaped story, `defineMapiStory()` produces the MAPI-shaped story, and the `Create` and `Update` variants narrow to the matching MAPI request payloads.

```ts
import { defineStory } from '@storyblok/schema';

const story = defineStory(pageBlock, {
  name: 'Home',
  slug: 'home',
  content: { component: 'page', title: 'Welcome' },
});
```

The package also exports the related types `Story`, `MapiStory`, `StoryCreate`, `StoryUpdate`, `StoryComponent`, `StoryAlternate`, `StoryLocalizedPath`, and `StoryTranslatedSlug`.

### createStoryHelpers()

```ts
createStoryHelpers()
createStoryHelpers().withTypes<T>()
```

Returns the four story helpers: `defineStory`, `defineMapiStory`, `defineStoryCreate`, and `defineStoryUpdate`. Chaining `.withTypes<T>()` pre-binds them to a project's component union, so call sites can omit the type parameter.

`withTypes<T>()` accepts either `{ components: Block }` or `{ blocks: Block }`. The latter matches the type produced by `Schema<typeof schema>`, so the project's `Schema` can be passed directly.

```ts
import { createStoryHelpers } from '@storyblok/schema';
import type { Schema } from './schema';

const { defineStory, defineMapiStory } = createStoryHelpers().withTypes<Schema>();
```

### Schema

```ts
type Schema<T>
```

Derives a schema-types interface from the shape `{ blocks, blockFolders?, datasources? }`. Each property becomes a union of the corresponding `define*` results, ready to be consumed by `createStoryHelpers().withTypes<…>()` and other typed consumers.

```ts
import type { Schema as InferSchema } from '@storyblok/schema';

export const schema = {
  blocks: { pageBlock, heroBlock },
  blockFolders: { layoutFolder },
  datasources: { colorsDatasource },
};

export type Schema = InferSchema<typeof schema>;
export type Blocks = Schema['blocks'];
export type BlockFolders = Schema['blockFolders'];
export type Datasources = Schema['datasources'];
```

### Other define helpers

The package exposes the same factory pattern for every Storyblok entity. Each `define*` helper returns a typed object. The `*Create` and `*Update` variants narrow the shape to the matching MAPI request payload.

| Helper(s) | Purpose |
| --- | --- |
| `defineAssetCreate`, `defineAssetUpdate`, `defineMapiAsset` | Asset payloads (signed upload, update, and full MAPI asset). |
| `defineAssetFolder`, `defineAssetFolderCreate`, `defineAssetFolderUpdate` | Asset folder (MAPI-only). |
| `defineInternalTag`, `defineInternalTagCreate`, `defineInternalTagUpdate` | Internal tag (MAPI-only). |
| `defineLink` | Link (CDN-only). |
| `definePreset`, `definePresetCreate`, `definePresetUpdate` | Component preset (MAPI-only). |
| `defineSpace`, `defineSpaceCreate`, `defineSpaceUpdate` | Space (MAPI-only). |
| `defineTag` | Tag (CDN-only). |
| `defineUser`, `defineUserUpdate` | User (MAPI-only). |

Each helper has a matching exported type (for example, `MapiAsset`, `AssetFolderCreate`, and `Preset`).
