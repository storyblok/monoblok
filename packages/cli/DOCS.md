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

- A property set to `null` clears the value in the target space. `internal_tag_ids: null` removes
  all tags, the same as `[]`.
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
in the local files. If a deleted preset was the default preset, the CLI clears the default preset in
the target space.
