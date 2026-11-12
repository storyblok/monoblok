<!-- target: src/content/docs/docs/libraries/js/schema/index.mdx#definefield -->
<!-- Replace the paragraph and table that start with "Besides the Management API field properties". -->

Besides the Management API field properties, `defineField()` accepts these keys and converts each to
a plain string in the result:

| Key          | Description                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allow`      | Restricts a `bloks` field to specific blocks or folders. Accepts a `defineBlock()` result, a block name, a `defineFolder()` result, or an array thereof. A single `allow` list restricts by either blocks or folders, not both. |
| `datasource` | Associates an `option`/`options` field with a datasource. Accepts a `defineDatasource()` result or a datasource slug.                                                                                                           |

Group and tab fields (the `section`, `tab`, and legacy `group` types) hold no value, so publishing a
story fails when its block marks one as required. `defineField()` rejects `required: true` on them.
`validateSchema()` also reports a group or tab field that a condition makes required.

<!-- target: src/content/docs/docs/tooling/cli/schema/init.mdx -->
<!-- Insert before the paragraph that starts with "After initialization". -->

When you change a field’s type in the **Block library**, the field keeps its settings. A group or
tab field can therefore still be required, which prevents publishing stories that use its block.
`schema init` makes these fields not required in the generated files and lists them in a warning.
The next [`schema push`](/docs/tooling/cli/schema/push) updates the space.

<!-- target: src/content/docs/docs/tooling/cli/schema/validate.mdx -->
<!-- Insert after the paragraph that starts with "The CLI resolves references by name". -->

`schema validate` also reports a required group or tab field, which prevents publishing stories that
use its block.
