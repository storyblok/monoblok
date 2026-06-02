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
| `--target <target>` | Push destination: `space`, `org`, or `all` | `space` (single asset), `all` (bulk) |
| `--library <libraryId>` | Destination library ID. Required for a single-asset `--target=shared`, rejected with `--target=space` | - |
| `--cleanup` | Delete local assets and metadata after a successful push | `false` |
| `--update-stories` | Update file references in stories if necessary | `false` |

## Shared libraries

A library is a top-level shared asset folder in the organization, with per-space read or write access. Push assets to a library with `--target=shared`:

```bash
# Push a single local file into library 7.
storyblok assets push --space YOUR_SPACE_ID --target shared --library 7 ./path/to/image.png

# Push every local subtree: the space and each writable library.
storyblok assets push --space YOUR_SPACE_ID --target all

# Push only the local library subtrees.
storyblok assets push --space YOUR_SPACE_ID --target shared
```

Library assets live under `.storyblok/assets/shared/<library_id>/`, each subtree with its own `manifest.jsonl`. Bulk pushes read every `shared/<library_id>/` subtree present on disk. Library-scoped tags (`internal_tag_ids`) are remapped to the library's shared tags, creating any that are missing, and `meta_data` round-trips unchanged.

> [!NOTE]
> Repeated pushes are idempotent only for assets that carry an identity. The CLI matches a local asset to its remote counterpart through the asset's `id` and the subtree's `manifest.jsonl`. Sidecars written by `assets pull` already include the remote `id`, so re-pushing them updates the existing library asset in place. A sidecar you author by hand without an `id`, and that has no manifest entry, has no identity, so each push creates a new copy in the library. To update an existing asset, include its `id` in the sidecar (or `--data`), or push from a subtree whose `manifest.jsonl` still maps it.

If the active space has only read access to a target library, the push fails fast, names the library, and writes no partial state. Libraries the space cannot access are skipped silently.
