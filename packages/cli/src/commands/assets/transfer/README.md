# Assets Transfer Command

The `assets transfer` command transfers existing assets from a space's local library into the organization's global asset library. This is a one-way operation: assets move from a space to the organization. There is no reverse operation.

## Basic usage

**Transfer a single asset:**

```bash
storyblok assets transfer 123456 --folder-id 789 --space YOUR_SPACE_ID
```

**Transfer multiple assets concurrently:**

```bash
storyblok assets transfer 123456 789012 345678 --folder-id 789 --space YOUR_SPACE_ID
```

**Preview the transfer plan without making any API calls:**

```bash
storyblok assets transfer 123456 789012 --folder-id 789 --space YOUR_SPACE_ID --dry-run
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `<asset-id...>` | (Required) One or more numeric asset IDs to transfer | - |
| `--folder-id <id>` | (Required) Destination folder ID in the global asset library | - |
| `-s, --space <id>` | Source space ID | Globally configured space |
| `-d, --dry-run` | Print the transfer plan without making any API calls | `false` |

## Notes

- **Endpoint mapping:** The CLI exposes this operation as `transfer`, but it currently calls the backend `convert` endpoint (`POST /v1/spaces/{space_id}/assets/{id}/convert`), mapping `--folder-id` to the required `target_asset_folder_id` query parameter. This mapping will be removed once the backend ships the rename from `convert` to `transfer`.
- **Plan required:** `--folder-id` is required and has no implicit default. Omitting it fails with an error.
- **403 errors:** A 403 response means the global asset library is not available on the current plan. Contact Storyblok support to enable it for your organization.
