# Staged docs: `@storyblok/schema` field plugin values

Staged docs-site content for field plugin value types. Each section starts with a `target` marker
naming the docs platform heading it belongs to. Add `Badge` to the page's
`@astrojs/starlight/components` import. The badge version assumes this change ships as a breaking
release; adjust it to the released version.

<!-- target: src/content/docs/docs/libraries/js/schema/index.mdx#definefieldplugin (replaces the section) -->

### `defineFieldPlugin()`

```ts
defineFieldPlugin(config);
```

Binds a Storyblok custom field `field_type` to a [Standard Schema](https://standardschema.dev)
validator. The helper infers both the `fieldType` literal and the value type from the single
argument. The `value` accepts any Standard Schema validator (Zod, Valibot, ArkType, or a
hand-written one) and the helper retains it for runtime use.

```ts
import { defineFieldPlugin } from "@storyblok/schema";
import { z } from "zod";

const colorPicker = defineFieldPlugin({
  fieldType: "my-custom-color-picker",
  value: z.object({ color: z.string(), alpha: z.number() }),
});
```

_Updated in_ <Badge text="0.6.0" variant="note" />

The validator describes the value the field plugin stores, which can be any JSON value: a string,
number, boolean, array, or object. The `Schema` type uses the validator output as the field's value
type for reading and writing content.

```ts
import { defineFieldPlugin } from "@storyblok/schema";
import { z } from "zod";

const starRating = defineFieldPlugin({
  fieldType: "my-star-rating",
  value: z.number().int().min(1).max(5),
});
```

Object values can also carry `plugin` and `_uid` keys, which some field plugins store next to their
own data. The value type adds both as optional strings. `validateStory()` checks them and removes
them before it runs the validator, so a strict object validator accepts a value that includes them.
Leave `plugin` and `_uid` out of the validator, because the validator never receives them.

A custom field whose `field_type` has no registered field plugin uses the `PluginFieldValue` type:
an object with a required `plugin` string. `validateStory()` reports any other value as an error.

Register field plugins under a `fieldPlugins` key so the `Schema` type maps each `fieldType` to its
validator output. The matching exported type is `FieldPlugin`.

Storyblok also ships official field plugins under the `@storyblok/schema/field-plugins` sub-path.
Import them individually so unused plugins tree-shake away:

```ts
import { storyblokColorField } from "@storyblok/schema/field-plugins";
```

`storyblokColorField` handles Storyblok’s official Colorpicker field (`storyblok-colorpicker`), and
exports its value type as `StoryblokColorFieldValue`.
