<!-- target: src/content/docs/docs/tooling/cli/components-push.mdx#pushed-properties (new section, insert after "Selective push" and before "Examples") -->

## Pushed properties

`components push` sends every writable component property and overwrites its value in the target
space:

- `name`, `display_name`, and `description`
- `preview_tmpl`, `image`, and `preview_field`
- `is_root` and `is_nestable`
- `preset_id` (the default preset)
- `component_group_uuid`, `color`, and `icon`
- `content_type_asset_preview`
- `internal_tag_ids`
- `schema` and `metadata`

The local file controls each property as follows:

- Setting one of these properties to `null` clears its value in the target space: `display_name`,
  `description`, `preview_tmpl`, `image`, `preview_field`, `preset_id`, `component_group_uuid`,
  `color`, `icon`, `content_type_asset_preview`, `internal_tag_ids`, and `metadata`.
  `internal_tag_ids: null` removes all tags, the same as `[]`.
- A property missing from the local file leaves the value in the target space unchanged.
- `schema: null` leaves the schema in the target space unchanged.

<Aside type="caution">
  The CLI copies `image` as is. After a push with `--from`, the image still points to the asset in the source space.
</Aside>

<!-- target: src/content/docs/docs/tooling/cli/components-push.mdx#presets (new section, insert after "Pushed properties") -->

## Presets

The CLI creates presets after their component, then sets the default preset. A first push to a space
that lacks the component therefore sets the default preset as well.

If the local `preset_id` doesn’t match one of the component’s presets in the local files, the CLI
leaves the default preset in the target space unchanged and logs a warning.

For each component that pushes successfully, the CLI deletes presets in the target space that aren’t
in the local files. If a deleted preset was the default preset, the component in the target space no
longer has a default preset.

<!-- target: src/content/docs/docs/tooling/cli/schema-push.mdx#block-properties (new section, insert after "Local component files") -->

## Block properties

`schema push` resets most block properties to their default when a block omits them. It treats three
properties differently: `image`, `preview_tmpl`, and `content_type_asset_preview`. A block controls
each of them as follows:

- A property set to a value overwrites the value in the space.
- A property set to `null` clears the value in the space.
- A property missing from the block leaves the value in the space unchanged, so values set in the
  Storyblok UI survive a push.

[`schema rollback`](/docs/tooling/cli/schema-rollback) restores these three properties only for
blocks that set them.

The space removes some HTML tags from `preview_tmpl`, such as `<h1>` and `<img>`. A template that
uses them differs from the stored value, so every push updates it again.

`schema push` ignores `preset_id`, because presets are specific to a space. It also ignores
`metadata`, which apps such as the Figma app use to link a block to their own data.

<Aside type="caution">
  `schema init` writes `image` as is. A block pushed to another space still points to the asset in the original space.
</Aside>
