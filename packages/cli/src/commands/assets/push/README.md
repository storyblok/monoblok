# Assets Push Command

The `assets push` command allows you to push assets from local files (and their metadata) to a Storyblok space, or upload a single asset by file path or URL.

## Basic Usage

Push assets from `.storyblok/assets/<space>`:

```bash
storyblok assets push --space YOUR_SPACE_ID
```

Upload a single local file:

```bash
storyblok assets push --space YOUR_SPACE_ID ./path/to/image.png
```

Upload a single remote URL:

```bash
storyblok assets push --space YOUR_SPACE_ID https://example.com/assets/image.png
```

Upload a single local file with a sidecar JSON file (same basename):

```bash
storyblok assets push --space YOUR_SPACE_ID ./path/to/image.png
```

```json
// ./path/to/image.json
{
  "meta_data": {
    "alt": "Hero image",
    "title": "Homepage hero"
  }
}
```

Upload a single local file with inline metadata and overrides:

```bash
storyblok assets push --space YOUR_SPACE_ID ./path/to/image.png \
  --data='{"meta_data":{"alt":"Hero image","alt__i18n__de":"Hero Bild"}}' \
  --filename="hero.png" \
  --folder=123
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to push assets to | - |
| `-p, --path <path>` | Base path where assets are read from (assets live under `<path>/assets`) | `.storyblok` |
| `-f, --from <from>` | Source space ID to read local assets from (useful for syncing between spaces) | Same as `--space` |
| `-d, --dry-run` | Preview changes without applying them to Storyblok | `false` |
| `--data <data>` | Inline asset data as JSON (supports Asset fields, `metadata` maps to `meta_data`) | - |
| `--filename <filename>` | Override the asset filename (defaults to the source filename) | - |
| `--folder <folderId>` | Destination asset folder ID | - |
| `--cleanup` | Delete local assets and metadata after a successful push | `false` |

## Notes

- Asset manifest files can contain multiple entries for the same asset; use the latest entry as the source of truth.
- External URL uploads are downloaded temporarily and removed after a successful push.
- When pushing from disk, ensure asset `.json` metadata files sit next to their binaries in `<path>/assets/<space>`.
