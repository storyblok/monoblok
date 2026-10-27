# Staged docs: `@storyblok/schema` field plugin values

Add `Badge` to the page's `@astrojs/starlight/components` import. Set the badge to the released
version.

<!-- target: src/content/docs/docs/libraries/js/schema/index.mdx#definefieldplugin (replaces the section) -->

### `defineFieldPlugin()`

```ts
defineFieldPlugin(config);
```

Binds a custom field `field_type` to a [Standard Schema](https://standardschema.dev) validator (Zod,
Valibot, ArkType, or a hand-written one). The validator output is the field's value type for reading
and writing.

```ts
import { defineFieldPlugin } from "@storyblok/schema";
import { z } from "zod";

const colorPicker = defineFieldPlugin({
  fieldType: "my-custom-color-picker",
  value: z.object({ color: z.string(), alpha: z.number() }),
});

const starRating = defineFieldPlugin({
  fieldType: "my-star-rating",
  value: z.number().int().min(1).max(5),
});
```

_Updated in_ <Badge text="0.6.0" variant="note" />

Field plugin values follow these rules:

- A value can be any JSON value: a string, number, boolean, array, or object.
- Object values accept an optional `_uid` string. `validateStory()` removes it before it runs the
  validator.
- Declare `plugin` in the validator if the field plugin stores it.
- Custom fields without a registered field plugin use `PluginFieldValue`, an object with a required
  `plugin` string.

Register field plugins under a `fieldPlugins` key so the `Schema` type maps each `fieldType` to its
validator output. The matching exported type is `FieldPlugin`.

Storyblok ships official field plugins under the `@storyblok/schema/field-plugins` sub-path. Import
them individually so unused plugins tree-shake away:

```ts
import { storyblokColorField } from "@storyblok/schema/field-plugins";
```

`storyblokColorField` handles Storyblok’s official Colorpicker field (`storyblok-colorpicker`). Its
value type, `StoryblokColorFieldValue`, is `{ color: string; plugin: "official-colorpicker" }`.
