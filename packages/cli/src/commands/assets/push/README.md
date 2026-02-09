# Assets Push Command

The `assets push` command allows you to push assets from local files (and their metadata) to a Storyblok space, or upload a single asset by file path or URL.

## Basic Usage

**Push assets from `.storyblok/assets/<space>`:**

```bash
storyblok assets push --space YOUR_SPACE_ID
```

**Upload a single local file:**

```bash
storyblok assets push --space YOUR_SPACE_ID ./path/to/image.png
```

**Upload a single remote URL:**

```bash
storyblok assets push --space YOUR_SPACE_ID https://example.com/assets/image.png
```

**Upload a single local file with a sidecar JSON file (same basename):**

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

**Upload a single local file with inline metadata and overrides:**

```bash
storyblok assets push --space YOUR_SPACE_ID ./path/to/image.png \
  --data='{"meta_data":{"alt":"Hero image"}}' \
  --short-filename="hero.png" \
  --folder=123
```

**Update a single existing file and stories referencing it:**

```bash
storyblok assets push --space YOUR_SPACE_ID ./path/to/image.png \
  --data='{"id":1234,"meta_data":{"alt":"Hero image"}}' \
  --update-stories
```

> [!NOTE]
> The new filename (`image.png`) has no effect on the asset's filename. This will only update the file and its metadata; the filename cannot be updated. Also, any filename override (via `--short-filename` or `short_filename` in the data) is ignored when updating an existing asset.

> [!TIP]
> The `--update-stories` flag is best used when updating a single asset. For bulk updates or migrations, it is significantly more performant to run `storyblok assets push` (without the flag) followed by `storyblok stories push`. The stories command automatically resolves and updates asset references using the asset manifest file.

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to push assets to | - |
| `-p, --path <path>` | Base path where assets are read from (assets live under `<path>/assets`) | `.storyblok` |
| `-f, --from <from>` | Source space ID to read local assets from (useful for syncing between spaces) | Same as `--space` |
| `-d, --dry-run` | Preview changes without applying them to Storyblok | `false` |
| `--data <data>` | Inline asset data as JSON (supports Asset fields, `metadata` maps to `meta_data`) | - |
| `--short-filename <short-filename>` | Override the asset filename (defaults to the source filename) | - |
| `--folder <folderId>` | Destination asset folder ID | - |
| `--cleanup` | Delete local assets and metadata after a successful push | `false` |
| `--update-stories` | Update file references in stories if necessary | `false` |
| `--asset-token <token>` | Asset token for accessing private assets | - |
