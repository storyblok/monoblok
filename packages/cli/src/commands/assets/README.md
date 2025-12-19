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
