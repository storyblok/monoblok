# Assets Pull Command

The `assets pull` command allows you to download assets and asset folders from your Storyblok space.

## Basic Usage

```bash
storyblok assets pull --space YOUR_SPACE_ID
```

Assets are saved as file+metadata pairs:
```
.storyblok/
└── assets/
    └── YOUR_SPACE_ID/
        ├── image_123.png
        ├── image_123.json
        ├── document_456.pdf
        ├── document_456.json
        └── folders/
            ├── Folder-1_550e8400-e29b-41d4-a716-446655440000.json
            └── manifest.jsonl
```

### Examples

Filter assets by query:

```bash
storyblok assets pull --space YOUR_SPACE_ID --query "search=my-file.jpg&with_tags=tag1,tag2"
```

Pull private assets (requires asset token):

```bash
storyblok assets pull --space YOUR_SPACE_ID --asset-token YOUR_ASSET_TOKEN
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to pull assets from | - |
| `--target <target>` | Pull source: `with-referenced`, `all`, `space`, or `org` | `with-referenced` |
| `-p, --path <path>` | Base path where assets are saved (assets are written to `<path>/assets/<space>`) | `.storyblok` |
| `-d, --dry-run` | Preview changes without applying them to Storyblok | `false` |
| `-q, --query <query>` | Filter assets using Storyblok filter query syntax (e.g., `--query="search=my-file.jpg&with_tags=tag1,tag2"`) | - |
| `--asset-token <token>` | Asset token for downloading private assets (learn more about [private assets](https://www.storyblok.com/docs/concepts/assets#private-assets)) | - |

## Global libraries

A library is a top-level shared asset folder in the organization. The `--target` flag controls which assets the command pulls:

- `with-referenced` (default): pull all space assets, then pull only the shared-library assets that the space's already-pulled local stories reference. With no local stories, only space assets are pulled and no library calls are made.
- `all`: pull all space assets and every readable library.
- `org`: pull every readable library, but not the space's own assets.
- `space`: pull only the space's own assets, with no library calls.

Library assets are saved under `.storyblok/assets/org/<library_id>/`, mirroring the space layout (binary, sidecar JSON, and `folders/`). Each subtree keeps its own `manifest.jsonl`.

```bash
# Pull space assets plus the library assets referenced by local stories.
storyblok assets pull --space YOUR_SPACE_ID

# Pull the space and every readable library.
storyblok assets pull --space YOUR_SPACE_ID --target all

# Pull only the readable libraries.
storyblok assets pull --space YOUR_SPACE_ID --target org
```

## Notes

- The command creates directories as needed.
- Asset folder metadata is stored under `<path>/assets/<space>/folders`.
- **Private Assets**: If your space contains [private assets](https://www.storyblok.com/docs/concepts/assets#private-assets), you must provide an `--asset-token` to download them. The asset token can be found in your Storyblok space settings under the "Assets" tab. Private assets without a token will result in an error during the pull operation.
