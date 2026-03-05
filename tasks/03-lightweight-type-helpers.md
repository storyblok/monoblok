# Part 3: Lightweight Type Helpers

Implement the `define*` helpers and all supporting TypeScript types exported from the root `@storyblok/schema` entry point. This entry point must have **zero runtime dependencies** — everything here is pure TypeScript types and identity functions.

## Acceptance criteria

- `import { defineField, defineProp, defineComponent, defineStory, defineAsset, defineDatasource } from "@storyblok/schema"` works.
- Hovering over a `defineField(...)` call in an IDE shows the narrowed type (not the broad union).
- Passing an invalid key to `defineField` produces a TypeScript error.
- Hovering over a `defineStory(...)` call shows content typed to the component's schema.
- Passing a wrong value type in `defineStory` content produces a TypeScript error.
- Passing an extra key in `defineStory` content produces a TypeScript error.
- `pnpm --filter @storyblok/schema test:types` passes.
- `pnpm --filter @storyblok/schema test:unit:ci` passes (type-level tests via `expectTypeOf`).

---

## Prerequisite

Part 1 must be complete. The generated file `src/generated/types.ts` (produced by `generate.ts`) must exist and export the raw OpenAPI-derived types for Story, Component, Asset, Datasource, and ComponentSchemaField. The types in this part wrap and extend those generated types.

---

## 3.1 Utility types — `src/types/utils.ts`

```ts
/**
 * Flattens an intersection type into a single object type for readable IDE display.
 * @example Prettify<{ a: string } & { b: number }> → { a: string; b: number }
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
```

---

## 3.2 Field types — `src/types/field.ts`

This is the most important file in Part 3. It defines the discriminated union type system for component fields.

### `FieldType`

The canonical union of all supported Storyblok field types. Derived from the documented types in the CAPI OpenAPI spec and the `ComponentSchemaField` description:

```ts
export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'markdown'
  | 'number'
  | 'datetime'
  | 'boolean'
  | 'option'
  | 'options'
  | 'asset'
  | 'multiasset'
  | 'multilink'
  | 'bloks'
  | 'table'
  | 'section'
  | 'tab'
  | 'custom';
```

### `FieldTypeConfigMap`

Maps each `FieldType` to its type-specific configuration properties (the keys that are only valid for that field type). These come from the `ComponentSchemaField` OpenAPI schema. Common properties shared across all field types (e.g., `display_name`, `required`, `translatable`) are not included here — they go in the base `Field` type.

```ts
// Asset value shape used by FieldTypeValueMap
// (re-exported from generated types)
import type { AssetField, MultilinkField, RichtextField, TableField, PluginField, StoryContent } from '../generated/types';

type FieldTypeConfigMap = {
  text:      { maxlength?: number; minlength?: number; rtl?: boolean; rich_markdown?: boolean };
  textarea:  { maxlength?: number; minlength?: number; rtl?: boolean };
  richtext:  { restrict_components?: boolean; component_whitelist?: string[]; customize_toolbar?: boolean };
  markdown:  { rich_markdown?: boolean; rtl?: boolean };
  number:    { minimum?: number; maximum?: number; decimals?: number; steps?: number };
  datetime:  { disable_time?: boolean };
  boolean:   { inline_label?: string };
  option:    { options?: Array<{ _uid?: string; name: string; value: string }>; source?: 'self' | 'internal' | 'external'; datasource_slug?: string; exclude_empty_option?: boolean; include_empty_option?: boolean };
  options:   { options?: Array<{ _uid?: string; name: string; value: string }>; source?: 'self' | 'internal' | 'external'; datasource_slug?: string; minimum_entries?: number; maximum_entries?: number };
  asset:     { filetypes?: string[]; folder_slug?: string; restrict_assets?: boolean; asset_whitelist?: string[]; allow_external_url?: boolean };
  multiasset:{ filetypes?: string[]; folder_slug?: string; restrict_assets?: boolean; asset_whitelist?: string[]; minimum_entries?: number; maximum_entries?: number };
  multilink: { restrict_content_types?: boolean; component_whitelist?: string[]; allow_target_blank?: boolean; force_link_scope?: boolean };
  bloks:     { restrict_components?: boolean; component_whitelist?: string[]; component_group_whitelist?: string[]; minimum?: number; maximum?: number; restrict_type?: string };
  table:     Record<string, never>;
  section:   { keys?: string[] };
  tab:       { keys?: string[] };
  custom:    { field_type?: string; options?: unknown };
};
```

### `FieldTypeValueMap`

Maps each `FieldType` to the shape of its value in story content at runtime. These types come from the shared OpenAPI field-type schemas (`shared/stories/field-types/`) which are used by both the CAPI and MAPI (after Part 0). The generated types (`AssetField`, `MultilinkField`, `RichtextField`, etc.) are available from either the CAPI or MAPI generated output since both now share the same `story-content.yaml` base:

```ts
type FieldTypeValueMap = {
  text:       string;
  textarea:   string;
  richtext:   RichtextField;
  markdown:   string;
  number:     number;
  datetime:   string;
  boolean:    boolean;
  option:     string;
  options:    string[];
  asset:      AssetField;
  multiasset: AssetField[];
  multilink:  MultilinkField;
  bloks:      StoryContent[];
  table:      TableField;
  section:    never;   // layout-only, no content value
  tab:        never;   // layout-only, no content value
  custom:     PluginField;
};
```

### Base field properties (shared across all field types)

From the `ComponentSchemaField` OpenAPI schema, applicable to all field types:

```ts
type BaseFieldProps = {
  display_name?: string;
  description?: string;
  translatable?: boolean;
  required?: boolean;
  regex?: string;
  default_value?: string;
  pos?: number;
};
```

### `Field<TFieldType>`

The main field type. Discriminated on `type`:

```ts
export type Field<TFieldType extends FieldType = FieldType> = Prettify<
  { type: TFieldType } &
  BaseFieldProps &
  FieldTypeConfigMap[TFieldType]
>;
```

---

## 3.3 Prop types — `src/types/prop.ts`

A prop is a field as configured within a specific component. It merges the field definition with component-level configuration.

```ts
import type { Field, FieldType } from './field';
import type { Prettify } from './utils';

/**
 * Component-level field configuration.
 * These keys exist on the prop but not on the standalone field.
 */
export type PropConfig = {
  pos?: number;
  required?: boolean;
};

/**
 * A field as configured within a component schema.
 * Merges field type + field config + component-level prop config.
 */
export type Prop<
  TField extends Field = Field,
  TPropConfig extends PropConfig = PropConfig,
> = Prettify<TField & TPropConfig>;
```

Note: `pos` and `required` appear in both `BaseFieldProps` and `PropConfig`. When `defineProp` merges them, the prop-level values win (spread order). This is intentional — the component level can override the field default.

---

## 3.4 Component types — `src/types/component.ts`

```ts
import type { Prop } from './prop';
import type { Prettify } from './utils';

/** A record of named props forming a component's schema. */
export type ComponentSchema = Record<string, Prop>;

/**
 * A Storyblok component definition.
 * TName is the literal component name (e.g., "hero", "page").
 * TSchema is the record of props defining the component's fields.
 */
export type Component<
  TName extends string = string,
  TSchema extends ComponentSchema = ComponentSchema,
> = Prettify<{
  name: TName;
  display_name?: string;
  is_root?: boolean;
  is_nestable?: boolean;
  schema: TSchema;
}>;
```

---

## 3.5 Story types — `src/types/story.ts`

```ts
import type { Component, ComponentSchema } from './component';
import type { FieldTypeValueMap } from './field';
import type { Prettify } from './utils';

/**
 * The content object of a story, typed to a specific component.
 * - `component` is always the literal component name.
 * - `_uid` is always present (assigned by Storyblok, optional in defineStory input).
 * - All other keys come from the component schema, typed to their value shapes.
 */
export type StoryContent<TComponent extends Component = Component> = Prettify<
  { component: TComponent['name']; _uid?: string } &
  {
    [K in keyof TComponent['schema']]: FieldTypeValueMap[TComponent['schema'][K]['type']]
  }
>;

/**
 * A Storyblok story typed to a specific component.
 * Includes all standard story metadata fields plus typed content.
 */
export type Story<TComponent extends Component = Component> = {
  // Typed content
  content: StoryContent<TComponent>;
  // Standard story metadata (from OpenAPI Story schema)
  id?: number;
  name?: string;
  slug?: string;
  full_slug?: string;
  uuid?: string;
  published?: boolean;
  published_at?: string | null;
  first_published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  tag_list?: string[];
  is_folder?: boolean;
  parent_id?: number | null;
  group_id?: string;
  alternates?: unknown[];
};
```

---

## 3.6 Asset and Datasource types — `src/types/asset.ts`, `src/types/datasource.ts`

These re-export and/or refine the generated OpenAPI types:

**`src/types/asset.ts`**
```ts
// Re-export from generated types, potentially with refinements
export type { Asset } from '../generated/types';
```

**`src/types/datasource.ts`**
```ts
export type { Datasource } from '../generated/types';
```

If the generated types are not clean enough (e.g., too many `unknown` fields), define refined versions inline here that map to the OpenAPI schema properties explicitly.

---

## 3.7 Types barrel — `src/types/index.ts`

```ts
export type { Prettify } from './utils';
export type { FieldType, Field, FieldTypeConfigMap, FieldTypeValueMap } from './field';
export type { PropConfig, Prop } from './prop';
export type { ComponentSchema, Component } from './component';
export type { StoryContent, Story } from './story';
export type { Asset } from './asset';
export type { Datasource } from './datasource';
```

---

## 3.8 Define helpers — `src/helpers/`

All helpers are identity functions (or near-identity). Their only job is to let TypeScript infer a precise type from the input. No runtime logic beyond basic object spreading.

### `src/helpers/define-field.ts`

```ts
import type { Field, FieldType } from '../types/field';

/**
 * Defines a reusable field configuration.
 * Returns the input as-is with a narrowed type based on the `type` discriminant.
 * Invalid keys for the given field type will produce a TypeScript error.
 *
 * @example
 * const headline = defineField({ type: 'text', maxlength: 100 });
 * // type: { type: "text"; maxlength: number; }
 */
export const defineField = <TFieldType extends FieldType>(
  field: Field<TFieldType>,
): Field<TFieldType> => field;
```

### `src/helpers/define-prop.ts`

```ts
import type { Field, FieldType } from '../types/field';
import type { Prop, PropConfig } from '../types/prop';

/**
 * Configures a field as a prop within a component schema.
 * Merges the field definition with component-level configuration (`pos`, `required`, etc.).
 *
 * @example
 * const headlineProp = defineProp(headlineField, { pos: 1, required: true });
 */
export const defineProp = <
  TFieldType extends FieldType,
  TPropConfig extends PropConfig,
>(
  field: Field<TFieldType>,
  config: TPropConfig,
): Prop<Field<TFieldType>, TPropConfig> => ({ ...field, ...config });
```

### `src/helpers/define-component.ts`

```ts
import type { Component, ComponentSchema } from '../types/component';

/**
 * Defines a Storyblok component with its schema.
 * Returns the input as-is with a narrowed type preserving the literal `name` type
 * and the precise schema shape.
 *
 * @example
 * const pageComponent = defineComponent({
 *   name: 'page',
 *   schema: {
 *     headline: defineProp(headlineField, { pos: 1 }),
 *   },
 * });
 */
export const defineComponent = <
  TName extends string,
  TSchema extends ComponentSchema,
>(
  component: Component<TName, TSchema>,
): Component<TName, TSchema> => component;
```

### `src/helpers/define-story.ts`

```ts
import type { Component, ComponentSchema } from '../types/component';
import type { Story, StoryContent } from '../types/story';

/**
 * Defines a story for a given component.
 * Automatically injects `component: component.name` into the content object.
 * The content type is constrained to the component's schema — wrong value types
 * and extra keys produce TypeScript errors.
 *
 * @example
 * const myStory = defineStory(pageComponent, {
 *   content: { headline: 'Hello World!' },
 * });
 * // myStory.content.component === 'page' (inferred)
 */
export const defineStory = <
  TName extends string,
  TSchema extends ComponentSchema,
>(
  component: Component<TName, TSchema>,
  story: Omit<Story<Component<TName, TSchema>>, 'content'> & {
    content: Omit<StoryContent<Component<TName, TSchema>>, 'component' | '_uid'>;
  },
): Story<Component<TName, TSchema>> => ({
  ...story,
  content: {
    ...story.content,
    component: component.name,
  } as StoryContent<Component<TName, TSchema>>,
});
```

### `src/helpers/define-asset.ts`

```ts
import type { Asset } from '../types/asset';

/**
 * Defines an asset object with type safety.
 * Returns the input as-is, validated against the Asset type.
 */
export const defineAsset = (asset: Asset): Asset => asset;
```

### `src/helpers/define-datasource.ts`

```ts
import type { Datasource } from '../types/datasource';

/**
 * Defines a datasource object with type safety.
 * Returns the input as-is, validated against the Datasource type.
 */
export const defineDatasource = (datasource: Datasource): Datasource => datasource;
```

### `src/helpers/index.ts`

```ts
export { defineField } from './define-field';
export { defineProp } from './define-prop';
export { defineComponent } from './define-component';
export { defineStory } from './define-story';
export { defineAsset } from './define-asset';
export { defineDatasource } from './define-datasource';
```

---

## 3.9 Update `src/index.ts`

```ts
// Types
export type { FieldType, Field, FieldTypeValueMap } from './types/field';
export type { PropConfig, Prop } from './types/prop';
export type { ComponentSchema, Component } from './types/component';
export type { StoryContent, Story } from './types/story';
export type { Asset } from './types/asset';
export type { Datasource } from './types/datasource';
export type { Prettify } from './types/utils';

// Define helpers (zero runtime dependencies — pure identity functions)
export { defineField } from './helpers/define-field';
export { defineProp } from './helpers/define-prop';
export { defineComponent } from './helpers/define-component';
export { defineStory } from './helpers/define-story';
export { defineAsset } from './helpers/define-asset';
export { defineDatasource } from './helpers/define-datasource';
```

---

## 3.10 Tests

### Unit tests — `test/helpers/`

These verify runtime behavior of the helpers (they are identity functions, so mostly checking that the output matches the input and that the merged shape is correct):

**`test/helpers/define-field.test.ts`**
- `defineField({ type: 'text', maxlength: 100 })` returns the exact same object
- `defineField({ type: 'option', options: [...] })` returns the exact same object
- All 17 field types can be defined without error

**`test/helpers/define-prop.test.ts`**
- `defineProp(field, { pos: 1, required: true })` returns merged object `{ ...field, pos: 1, required: true }`
- Prop-level `required` overrides field-level `required`

**`test/helpers/define-component.test.ts`**
- `defineComponent({ name: 'page', schema: { ... } })` returns the exact same object

**`test/helpers/define-story.test.ts`**
- `defineStory(component, { content: { headline: 'Hello' } })` returns story with `content.component === component.name`
- The returned object contains the merged content (field values + `component` key)

**`test/helpers/define-asset.test.ts`** and **`test/helpers/define-datasource.test.ts`**
- Identity function: returns the input unchanged

### Type-level tests — `test/types/type-inference.test-d.ts`

Use vitest's `expectTypeOf` to assert type inference at compile time:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import { defineField, defineComponent, defineProp, defineStory } from '../../src/index';
import type { Story, StoryContent } from '../../src/types/story';

describe('defineField type inference', () => {
  it('narrows type based on field type discriminant', () => {
    const f = defineField({ type: 'text', maxlength: 100 });
    expectTypeOf(f.type).toEqualTypeOf<'text'>();
    expectTypeOf(f.maxlength).toEqualTypeOf<number | undefined>();
  });

  it('does not include config keys from other field types', () => {
    const f = defineField({ type: 'text', maxlength: 100 });
    // @ts-expect-error 'options' is not a valid key for 'text' fields
    void f.options;
  });
});

describe('defineStory type inference', () => {
  it('constrains content to component schema types', () => {
    const component = defineComponent({
      name: 'page',
      schema: {
        headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
        count: defineProp(defineField({ type: 'number' }), { pos: 2 }),
      },
    });

    const story = defineStory(component, {
      content: { headline: 'Hello', count: 42 },
    });

    expectTypeOf(story.content.component).toEqualTypeOf<'page'>();
    expectTypeOf(story.content.headline).toEqualTypeOf<string>();
    expectTypeOf(story.content.count).toEqualTypeOf<number>();
  });

  it('rejects wrong value types in content', () => {
    const component = defineComponent({
      name: 'page',
      schema: {
        headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
      },
    });

    defineStory(component, {
      // @ts-expect-error: number is not assignable to string
      content: { headline: 42 },
    });
  });
});
```

---

## Key design decisions

### Why `NoInfer` is not used in the draft's `defineField`

The draft implementation used `NoInfer<FieldTypeConfigMap[TFieldType]>` to prevent TypeScript from widening the inferred type. With the `Prettify` approach and `& FieldTypeConfigMap[TFieldType]` intersection, TypeScript narrows correctly without `NoInfer`. Validate during implementation and add `NoInfer` if needed.

### Why `section` and `tab` map to `never` in `FieldTypeValueMap`

These are layout-only fields in the Storyblok editor. They hold no value in story content. Using `never` means a component with a `section` or `tab` prop will never have that key in `StoryContent` (since a `never` value is impossible to provide). Consider excluding these keys from `StoryContent` entirely using a conditional type if `never` causes issues.

### `_uid` in `StoryContent`

Storyblok assigns `_uid` automatically. It is optional in `defineStory` input but always present in stored story content. Marking it `optional` in `StoryContent` allows both use cases.
