# Assets Transfer Command

The `assets transfer` command transfers existing assets from a space's local library into the organization's shared asset library. This is a one-way operation: assets move from a space to the organization. There is no reverse operation.

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

**Transfer every asset in a space:**

```bash
storyblok assets transfer --all --folder-id 789 --space YOUR_SPACE_ID
```

**Preview an `--all` transfer without making any API calls:**

```bash
storyblok assets transfer --all --folder-id 789 --space YOUR_SPACE_ID --dry-run
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `[asset-id...]` | One or more numeric asset IDs to transfer. Required unless `--all` is used. | - |
| `--folder-id <id>` | (Required) Destination folder ID in the shared asset library | - |
| `-s, --space <id>` | Source space ID | Globally configured space |
| `-d, --dry-run` | Print the transfer plan without making any API calls | `false` |
| `--all` | Transfer every asset in the space. Cannot be combined with explicit asset IDs. | `false` |

## Notes

- **Endpoint mapping:** The CLI exposes this operation as `transfer`, but it currently calls the backend `convert` endpoint (`POST /v1/spaces/{space_id}/assets/{id}/convert`), mapping `--folder-id` to the required `target_asset_folder_id` query parameter. This mapping will be removed once the backend ships the rename from `convert` to `transfer`.
- **Plan required:** `--folder-id` is required and has no implicit default. Omitting it fails with an error.
- **403 errors:** A 403 response comes from the backend authorization policy: the target folder must exist in the shared asset library and the source space must have write access to it. Grant the space write access to the destination folder (or pick a folder it can write to), then retry.
- **`--all`:** Transfers every asset in the space into `--folder-id`. It enumerates the space's assets first, so `--dry-run` reports an accurate count. `--all` cannot be combined with explicit asset IDs. If the space has no assets, the command exits 0 and prints a "No assets found" message.
