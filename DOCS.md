<!-- target: src/content/docs/docs/libraries/js/schema/index.mdx#definefield -->
<!-- Replace the paragraph and table that start with "Besides the Management API field properties". -->

Besides the Management API field properties, `defineField()` accepts two more keys and converts each
to a plain string in the result:

| Key          | Description                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allow`      | Restricts a `bloks` field to specific blocks or folders. Accepts a `defineBlock()` result, a block name, a `defineFolder()` result, or an array thereof. A single `allow` list restricts by either blocks or folders, not both. |
| `datasource` | Associates an `option`/`options` field with a datasource. Accepts a `defineDatasource()` result or a datasource slug.                                                                                                           |

Tab, section, and group fields hold no value, so `defineField()` rejects `required` on them, both as
a key and through `requiredWhen()`. The Management API rejects publishing a story whose block has a
required tab, section, or group field. `validateSchema()` reports the same mistake in schemas that
`defineField()` doesn't check, such as plain field objects.

<!-- target: src/content/docs/docs/tooling/cli/schema/init.mdx -->
<!-- Insert before the paragraph that starts with "After initialization". -->

The block editor keeps a field’s settings when you change its type, so a tab, section, or group
field in a space can carry settings its type doesn’t support, such as `required`. `schema init`
leaves these settings out of the generated files and lists them. The next
[`schema push`](/docs/tooling/cli/schema/push) removes them from the space.
