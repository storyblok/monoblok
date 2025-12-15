# Stories Push Command

The `stories push` command allows you to push stories from local `.json` files to a Storyblok space.

## Basic Usage

Keep component schemas up to date before pushing so references can be resolved:

```bash
storyblok components pull --space YOUR_SPACE_ID
```

Then push your local stories:

```bash
storyblok stories push --space YOUR_SPACE_ID
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to push stories to | - |
| `-p, --path <path>` | Base path where stories and components are read from (stories and components live under `<path>/stories` and `<path>/components`) | `.storyblok` |
| `-f, --from <from>` | Source space ID to read local stories/components from (useful for syncing between spaces) | Same as `--space` |
| `-d, --dry-run` | Preview changes without applying them to Storyblok | `false` |
| `--publish` | Publish stories after pushing (otherwise they remain unpublished/unpublished changes) | `false` |

## Notes

- Component schemas are required to map story references correctly. Always run `storyblok components pull` to fetch the latest schemas before running `storyblok stories push`.
