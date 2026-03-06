# Part 2: Lightweight Type Helpers

Implement the `define*` helpers and all supporting TypeScript types exported from the root `@storyblok/schema` entry point. This entry point must have **zero runtime dependencies** — everything here is pure TypeScript types and identity functions.

**Core principle: all type shapes must be auto-generated from the OpenAPI spec.** No hand-authored property lists. The only manually-authored type is `FieldTypeValueMap` (domain knowledge mapping config types to runtime value types). Everything else — field config shapes, component metadata, story metadata, asset, datasource — derives from the generated types produced by Part 1's `generate.ts`.

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

Part 1 must be complete. The generated file `src/generated/types.ts` (produced by `generate.ts`) must exist and export the raw OpenAPI-derived types for Story, Component, Asset, Datasource, and ComponentSchemaField.

### Required OpenAPI spec changes

Before the types in this part can work, the `@storyblok/openapi` MAPI components spec must be updated so the generator produces a proper discriminated union for field configs:

1. **Create 17 per-field-type YAML files** in `resources/mapi/components/field-types/`, one for each field type (text, textarea, richtext, markdown, number, datetime, boolean, option, options, asset, multiasset, multilink, bloks, table, section, tab, custom).
2. **Each YAML file** must be a flat `type: object` with `required: [type]` and a `type` property with `enum: [<literal>]` as the discriminant. All base properties (display_name, description, translatable, required, regex, default_value, pos, rich_text, markdown, size, height, width, use_uuid, multiple, custom_css, custom_js, api_connection, fieldset) must be repeated in each file (no `allOf` composition — `openapi-zod-client` silently falls back to `z.union()` when `allOf` has >1 item). Type-specific properties go after the base ones.
3. **Replace the flat `ComponentSchemaField`** in `main.yaml` with a `oneOf` + `discriminator` referencing all 17 `$ref`s.
4. **Rebuild `@storyblok/openapi`** (`pnpm --filter @storyblok/openapi build`) and **regenerate** (`pnpm --filter @storyblok/schema generate`).

After this, the generated output will contain:
- `ComponentSchemaField` as a TypeScript union of all 17 config types
- `z.discriminatedUnion("type", [...])` in the Zod schemas
- Individual named types like `text_field_config`, `bloks_field_config`, etc., each with `type` as a required literal

### Required `generate.ts` changes

The generator must be updated to handle two schemas (`Asset`, `Datasource`) that are invisible to `openapi-zod-client`'s dependency graph (they have no `$ref` cross-references, so they never get TS types):

- After merging all spec contexts, inject `Asset` and `Datasource` into `mergedContext.types` so they appear in the generated `types.ts`.
- The `.passthrough()` that `openapi-zod-client` adds to every Zod object schema causes `z.infer<typeof X>` to produce types with `& { [k: string]: unknown }`, which breaks structural typing. Avoid using `z.infer` for these types — instead, inject them as proper TypeScript type alias strings derived from the Zod schema structure, or strip `.passthrough()` from the schemas before deriving types.

---

## 2.1 Utility types — `src/types/utils.ts`

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

## 2.2 Field types — `src/types/field.ts`

This is the most important file in Part 2. It defines the discriminated union type system for component fields. **All field config shapes are derived from the generated types — no manual property definitions.**

### `FieldType`

Derived from the generated `ComponentSchemaField` discriminated union:

```ts
import type { ComponentSchemaField } from '../generated/types';

export type FieldType = ComponentSchemaField['type'];
```

This produces the union `'text' | 'textarea' | 'richtext' | ... | 'custom'` automatically from the generated types.

### `FieldTypeConfigMap`

A structural lookup table mapping each field type literal to its generated config type. **This does not define any new type shapes** — it merely maps string literals to the already-generated types:

```ts
import type {
  text_field_config,
  textarea_field_config,
  richtext_field_config,
  // ... all 17 generated config types
} from '../generated/types';

export type FieldTypeConfigMap = {
  text: text_field_config;
  textarea: textarea_field_config;
  richtext: richtext_field_config;
  markdown: markdown_field_config;
  number: number_field_config;
  datetime: datetime_field_config;
  boolean: boolean_field_config;
  option: option_field_config;
  options: options_field_config;
  asset: asset_field_config;
  multiasset: multiasset_field_config;
  multilink: multilink_field_config;
  bloks: bloks_field_config;
  table: table_field_config;
  section: section_field_config;
  tab: tab_field_config;
  custom: custom_field_config;
};
```

Each generated type (e.g., `text_field_config`) already includes the `type` discriminant, all base properties, and all type-specific properties. There is no separate `BaseFieldProps` type.

### `FieldTypeValueMap`

**The only manually-authored type.** Maps each field type discriminant to its runtime content value shape. This is domain knowledge connecting config schemas to content schemas — not expressible in the OpenAPI spec:

```ts
import type {
  asset_field as AssetField,
  multilink_field as MultilinkField,
  richtext_field as RichtextField,
  table_field as TableField,
  plugin_field as PluginField,
  story_content as StoryContentGenerated,
} from '../generated/types';

export type FieldTypeValueMap = {
  text: string;
  textarea: string;
  richtext: RichtextField;
  markdown: string;
  number: number;
  datetime: string;
  boolean: boolean;
  option: string;
  options: string[];
  asset: AssetField;
  multiasset: AssetField[];
  multilink: MultilinkField;
  bloks: StoryContentGenerated[];
  table: TableField;
  section: never;   // layout-only, no content value
  tab: never;       // layout-only, no content value
  custom: PluginField;
};
```

### `FieldVariant<TFieldType>` and `Field<TFieldType>`

```ts
/**
 * A single field variant for a specific field type.
 * Directly aliases the generated config type for that discriminant.
 */
export type FieldVariant<TFieldType extends FieldType> = FieldTypeConfigMap[TFieldType];

/**
 * The main field type. Discriminated on `type`.
 * When used with a specific type (e.g., Field<'text'>), produces a narrowed type.
 * When used with the default (full FieldType union), produces the full discriminated union.
 */
export type Field<TFieldType extends FieldType = FieldType> =
  TFieldType extends FieldType
    ? FieldVariant<TFieldType>
    : never;
```

---

## 2.3 Prop types — `src/types/prop.ts`

A prop is a field as configured within a specific component. It merges the field definition with component-level configuration.

```ts
import type { Field } from './field';
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
 * Merges field type + component-level prop config.
 * PropConfig keys override field-level keys (e.g., `required`).
 */
export type Prop<
  TField extends Field = Field,
  TPropConfig extends PropConfig = PropConfig,
> = Prettify<Omit<TField, keyof TPropConfig> & TPropConfig>;
```

Note: `Omit<TField, keyof TPropConfig> & TPropConfig` ensures prop-level values override field-level values without producing `never` from conflicting literal intersections (e.g., `required: false & required: true`).

---

## 2.4 Component types — `src/types/component.ts`

**Metadata fields are derived from the generated `component` type**, not hand-authored:

```ts
import type { component } from '../generated/types';
import type { Prop } from './prop';
import type { Prettify } from './utils';

/** A record of named props forming a component's schema. */
export type ComponentSchema = Record<string, Prop>;

/**
 * A Storyblok component definition.
 * TName is the literal component name (e.g., "hero", "page").
 * TSchema is the record of props defining the component's fields.
 *
 * Metadata fields (display_name, is_root, is_nestable, etc.) are derived from
 * the generated `component` type. They are all Partial because this type is used
 * for schema authoring (defineComponent), not for API response deserialization.
 * `name` and `schema` are overridden with generic parameters for type-safe inference.
 */
export type Component<
  TName extends string = string,
  TSchema extends ComponentSchema = ComponentSchema,
> = Prettify<
  Partial<Omit<component, 'name' | 'schema'>> & {
    name: TName;
    schema: TSchema;
  }
>;
```

---

## 2.5 Story types — `src/types/story.ts`

**Metadata fields are derived from the generated `story_mapi` type**, not hand-authored:

```ts
import type { story_mapi } from '../generated/types';
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
 * Metadata fields are derived from the generated story_mapi type.
 * They are all Partial because this type is used for schema authoring
 * (defineStory), not for API response deserialization.
 * The `content` field is overridden with a component-aware generic.
 */
export type Story<TComponent extends Component = Component> = Prettify<
  Partial<Omit<story_mapi, 'content'>> & {
    content: StoryContent<TComponent>;
  }
>;
```

---

## 2.6 Asset and Datasource types — `src/types/asset.ts`, `src/types/datasource.ts`

**Pure re-exports from the generated types:**

**`src/types/asset.ts`**
```ts
export type { Asset } from '../generated/types';
```

**`src/types/datasource.ts`**
```ts
export type { Datasource } from '../generated/types';
```

These types must be clean structural types (no `& { [k: string]: unknown }` from Zod's `.passthrough()`). If the generated types use `z.infer` and produce passthrough artifacts, fix the generation in `generate.ts` (see Prerequisite section).

---

## 2.7 Types barrel — `src/types/index.ts`

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

## 2.8 Define helpers — `src/helpers/`

All helpers are hand-authored identity functions (or near-identity). Their only job is to let TypeScript infer a precise type from the input. No runtime logic beyond basic object spreading. **They must import and use only generated/derived types — no manual type definitions.**

### `src/helpers/define-field.ts`

```ts
import type { Field, FieldType } from '../types/field';

/**
 * Defines a reusable field configuration.
 * Returns the input as-is with a narrowed type based on the `type` discriminant.
 * Invalid keys for the given field type will produce a TypeScript error.
 *
 * Uses Extract<Field, { type: TFieldType }> to resolve the exact discriminated
 * union member, enabling TypeScript to narrow the return type properly.
 *
 * @example
 * const headline = defineField({ type: 'text', maxlength: 100 });
 * // type: text_field_config
 */
export const defineField = <TFieldType extends FieldType>(
  field: Extract<Field, { type: TFieldType }>,
): Extract<Field, { type: TFieldType }> => field;
```

### `src/helpers/define-prop.ts`

```ts
import type { Field } from '../types/field';
import type { Prop, PropConfig } from '../types/prop';

/**
 * Configures a field as a prop within a component schema.
 * Merges the field definition with component-level configuration (`pos`, `required`, etc.).
 *
 * @example
 * const headlineProp = defineProp(headlineField, { pos: 1, required: true });
 */
export const defineProp = <
  TField extends Field,
  TPropConfig extends PropConfig,
>(
  field: TField,
  config: TPropConfig,
): Prop<TField, TPropConfig> => ({ ...field, ...config });
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

## 2.9 Update `src/index.ts`

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

## 2.10 Tests

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

### Why all type shapes must come from generated types

Manually-authored type shapes (like `BaseFieldProps`, `FieldTypeConfigMap` entries, `Story` metadata, `Component` metadata) drift out of sync with the OpenAPI spec as the API evolves. By deriving everything from the generated types, schema changes in `@storyblok/openapi` automatically propagate to all consumers.

### Why `FieldTypeValueMap` is the exception

`FieldTypeValueMap` maps field config types (OpenAPI management API) to their runtime content value types (OpenAPI content API). These are two separate domains — a `text` config produces a `string` value, an `asset` config produces an `AssetField` value. This mapping is domain knowledge that cannot be expressed within a single OpenAPI spec. It is the one manually-authored type that must be kept in sync when new field types are added.

### Why `Extract<Field, { type: TFieldType }>` in `defineField`

The naive signature `<TFieldType extends FieldType>(field: FieldVariant<TFieldType>)` causes TypeScript to infer `TFieldType` as the full `FieldType` union instead of the specific literal (e.g., `'text'`). This happens because `FieldVariant<TFieldType>` is an indexed access type that TypeScript can't "reverse lookup" from. Using `Extract<Field, { type: TFieldType }>` resolves the exact discriminated union member, enabling proper narrowing of the return type.

### Why `Prop` uses `Omit` instead of intersection

`Prop<TField, TPropConfig> = Prettify<Omit<TField, keyof TPropConfig> & TPropConfig>` ensures prop-level values override field-level values cleanly. A plain intersection (`TField & TPropConfig`) produces `never` when literal types conflict — e.g., a field with `required: false` intersected with `{ required: true }` gives `never` because `false & true` is impossible.

### Why `Component` and `Story` use `Partial<Omit<generated, ...>>`

The generated `component` and `story_mapi` types represent **API response** shapes with required fields like `id`, `created_at`, `updated_at`. The `define*` helpers are for **schema authoring** — users provide `name` and `schema`, not `id` or `created_at`. Wrapping in `Partial<Omit<...>>` makes all API-response-only metadata optional while preserving the generic parameters for type-safe inference.

### The `.passthrough()` problem

`openapi-zod-client` adds `.passthrough()` to every Zod object schema (from the `strictObjects: true` option, which generates `.strict()` that is then cleaned up to `.passthrough()`). When TypeScript types are derived via `z.infer<typeof X>`, the `.passthrough()` adds `& { [k: string]: unknown }` to the inferred type, which breaks structural assignability. For types that are injected via `z.infer` (like `Asset` and `Datasource`), this must be resolved — either by stripping `.passthrough()` in `renderOutput()`, or by generating proper TypeScript type strings directly instead of using `z.infer`.

### Why `section` and `tab` map to `never` in `FieldTypeValueMap`

These are layout-only fields in the Storyblok editor. They hold no value in story content. Using `never` means a component with a `section` or `tab` prop will never have that key in `StoryContent` (since a `never` value is impossible to provide). Consider excluding these keys from `StoryContent` entirely using a conditional type if `never` causes issues.

### `_uid` in `StoryContent`

Storyblok assigns `_uid` automatically. It is optional in `defineStory` input but always present in stored story content. Marking it `optional` in `StoryContent` allows both use cases.
