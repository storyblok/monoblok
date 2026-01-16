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
| `-p, --path <path>` | Base path where assets are saved (assets are written to `<path>/assets/<space>`) | `.storyblok` |
| `-d, --dry-run` | Preview changes without applying them to Storyblok | `false` |
| `-q, --query <query>` | Filter assets using Storyblok filter query syntax (e.g., `--query="search=my-file.jpg&with_tags=tag1,tag2"`) | - |
| `--asset-token <token>` | Asset token for downloading private assets (learn more about [private assets](https://www.storyblok.com/docs/concepts/assets#private-assets)) | - |

## Notes

- The command creates directories as needed.
- Asset folder metadata is stored under `<path>/assets/<space>/folders`.
- **Private Assets**: If your space contains [private assets](https://www.storyblok.com/docs/concepts/assets#private-assets), you must provide an `--asset-token` to download them. The asset token can be found in your Storyblok space settings under the "Assets" tab. Private assets without a token will result in an error during the pull operation.
