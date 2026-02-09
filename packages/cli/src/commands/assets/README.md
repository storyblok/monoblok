# Assets Command

The `assets` module provides tools to manage Storyblok assets and asset folders.

## Subcommands

- [`pull`](./pull/README.md): Download assets from your Storyblok space.
- [`push`](./push/README.md): Upload assets to your Storyblok space.

> See each subcommand for detailed usage, options, and examples.

## Common Workflows

### Space-to-Space Migration

1. Export assets from the source space: `storyblok assets pull --space SOURCE_ID`.
2. Push assets into the target space (reusing exported assets via `--from`): `storyblok assets push --space TARGET_ID --from SOURCE_ID`.

### Third-Party CMS to Storyblok

1. Export binaries and metadata from the source system.
2. Place assets under `.storyblok/assets/TARGET_ID` as file+JSON pairs.
3. Push assets into Storyblok: `storyblok assets push --space TARGET_ID` (use `--dry-run` first to validate).

**Example asset payloads (set `id` to the source system values):**

```json
// wordpress -> Storyblok
{
  "id": 9876, // asset ID from WordPress
  "short_filename": "hero.png", // The name must match the file on disk!
  "meta_data": {
    "alt": "Hero from WP",
    "title": "Hero image"
  }
}
```

```json
// drupal -> Storyblok
{
  "id": 5432, // asset ID from Drupal
  "short_filename": "cover.jpg", // The name must match the file on disk!
  "meta_data": {
    "alt": "Cover from Drupal",
    "title": "Cover image"
  }
}
```

**Example for folders:**

Folders are stored in a flat list with parent references.
In `.storyblok/assets/<space>/folders/`, you will find one JSON file per folder:

```json
// wordpress -> Storyblok (.storyblok/assets/123/folders/marketing_100.json)
{
  "id": 100, // source WordPress category ID
  "name": "Marketing Assets",
  "parent_id": 0,
  "uuid": "100", // same as the source ID to keep mapping simple
  "parent_uuid": null
}
```

```json
// drupal -> Storyblok (.storyblok/assets/123/folders/campaigns_200.json)
{
  "id": 200, // source Drupal taxonomy term ID
  "name": "Social Media Campaigns",
  "parent_id": 100, // References the parent folder ID
  "uuid": "200", // same as the source ID to keep mapping simple
  "parent_uuid": "100"
}
```

### Programmatically Updating Assets

1. Pull current assets: `storyblok assets pull --space YOUR_SPACE_ID`.
2. Modify the JSON files via scripts/automation (e.g., run a Node script to adjust metadata).
3. Push updates back: `storyblok assets push --space YOUR_SPACE_ID` (optionally `--dry-run`).

## Asset Manifest

The CLI maintains a manifest file at `.storyblok/assets/<space>/manifest.jsonl` (and `folders/manifest.jsonl`) to track the mapping between source IDs/filenames and the destination IDs/filenames. This is crucial for:

- **Idempotency:** Preventing duplicate uploads if an asset has already been migrated.
- **Reference Resolution:** Allowing the `stories` command to update asset references in your content using the new IDs.

## The Role of `manifest.jsonl` and `folders/manifest.jsonl`

The `manifest.jsonl` files created when running `storyblok assets push` act as a reference integrity backbone. Their role is critical for the following functions:

1. **Identity Translation (Migration Mapping)**
The manifests serve as a persistent translation table that maps "Source IDs" to "Target IDs".
   - **Space-to-Space:** It maps IDs from a source Storyblok space to a target space.
   - **Third-Party CMS:** When migrating from systems like WordPress or Drupal, the manifest maps external IDs as the "old" keys, allowing the CLI to treat the external system as the source of truth.
2. **Idempotency and Duplicate Prevention**
Storyblok generates new, unique IDs upon creation. Without a manifest, the CLI has no way of knowing if a local file has been pushed before. The manifests ensure syncing works correctly. It helps the CLI to recognize that an item exists and updates the existing record instead of creating a duplicate.
3. **Incremental Workflows**
Manifests enable a "pull-modify-push" cycle. A user can pull a single asset to edit its metadata locally (e.g., updating an alt tag) and push it back. Because the manifest persists the relationship between the local file and the remote entity, the CLI correctly targets the existing item in the target space, even if the local source files were previously cleaned up.
