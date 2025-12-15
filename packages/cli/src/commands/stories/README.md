# Stories Command

The `stories` module provides tools to manage Storyblok stories and their content.

## Subcommands

- [`pull`](./pull/README.md): Download stories from your Storyblok space.
- [`push`](./push/README.md): Upload stories to your Storyblok space.

> See each subcommand for detailed usage, options, and examples.

## Common Workflows

### Space-to-Space Migration

1. Export stories from the source space: `storyblok stories pull --space SOURCE_ID`.
2. Keep schemas aligned locally: `storyblok components pull --space SOURCE_ID`.
3. Push the components into the target space so references resolve: `storyblok components push --space TARGET_ID --from SOURCE_ID`.
4. Push stories into the target space (reusing exported stories/components via `--from`): `storyblok stories push --space TARGET_ID --from SOURCE_ID`.
5. Add `--publish` when you want the migrated stories published immediately.

### Third-Party CMS to Storyblok

1. Map your external content into the Storyblok story JSON structure used in `.storyblok/stories/<space>`.
2. Ensure required components exist: `storyblok components pull --space TARGET_ID`.
3. Place generated story files under `.storyblok/stories/TARGET_ID/{slug}_{ID}.json` and run `storyblok stories push --space TARGET_ID` (use `--dry-run` first to validate).

**Example story payloads (set `id` and `uuid` to the source system values):**

```json
// wordpress -> Storyblok
{
  "id": 12345, // source WordPress ID
  "uuid": 12345, // same as the source ID to keep mapping simple
  "name": "Hello WordPress",
  "slug": "hello-wordpress",
  "content": {
    "component": "page",
    "headline": "Hello from WP",
    "cta": {
      "fieldtype": "multilink",
      "linktype": "story",
      "id": 12346, // linked WP post ID (same as that story's uuid)
      "url": "",
      "cached_url": "related-post"
    }
  }
}
```

```json
// drupal -> Storyblok
{
  "id": 67890, // source Drupal node ID
  "uuid": 67890, // same as the source ID to keep mapping simple
  "name": "Drupal Article",
  "slug": "drupal-article",
  "content": {
    "component": "page",
    "headline": "Migrated from Drupal",
    "cta": {
      "fieldtype": "multilink",
      "linktype": "story",
      "id": 67891, // linked Drupal node ID (same as that story's uuid)
      "url": "",
      "cached_url": "related-article"
    }
  }
}
```

**Field i18n example (use `__i18n__<locale>` suffixes for translated variants of the same field):**

```json
{
  "id": 55555,
  "uuid": 55555,
  "name": "Hello i18n",
  "slug": "hello-i18n",
  "content": {
    "component": "page",
    "headline": "Hello",
    "headline__i18n__de": "Hallo",
    "headline__i18n__fr": "Bonjour"
  }
}
```

**Example for folders – in Storyblok, folders are stories too:**

```json
{
  "id": 3000,
  "uuid": 3000,
  "name": "Blog",
  "slug": "blog",
  "full_slug": "blog",
  "is_folder": true // Mark this story as a folder
}
```

```json
{
  "id": 3001,
  "uuid": 3001,
  "name": "Hello Blog",
  "slug": "hello-blog",
  "full_slug": "blog/hello-blog", // `full_slug` of folder + `slug` of this story
  "parent_id": 3000, // folder ID
  "content": { "component": "page", "headline": "Nested under Blog" }
}
```

### Programmatically Updating Stories

1. Pull current stories: `storyblok stories pull --space YOUR_SPACE_ID`.
2. Modify the JSON files via scripts/automation (e.g., run a Node script to adjust fields, slugs, or references).
3. Push updates back: `storyblok stories push --space YOUR_SPACE_ID` (optionally `--publish` or `--dry-run`).
