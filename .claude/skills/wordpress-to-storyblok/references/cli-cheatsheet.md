# Storyblok CLI cheatsheet

The non-obvious contract bits the migration depends on.

## `--from <source>` resolves to `.storyblok/<type>/<source>/`

| Command | Reads from |
|---|---|
| `storyblok stories push --from wordpress` | `.storyblok/stories/wordpress/` and `.storyblok/components/wordpress/` |
| `storyblok assets push --from wordpress` | `.storyblok/assets/wordpress/` |
| `storyblok datasources push --from wordpress` | `.storyblok/datasources/wordpress/datasources.json` |

The `<source>` segment is just a label — anything works. We use `wordpress` everywhere.
