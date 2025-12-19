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

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to pull assets from | - |
| `-p, --path <path>` | Base path where assets are saved (assets are written to `<path>/assets/<space>`) | `.storyblok` |
| `-d, --dry-run` | Preview changes without applying them to Storyblok | `false` |
| `-q, --query <query>` | Filter assets using Storyblok filter query syntax (e.g., `--query="[in_folder][eq]=123"`) | - |

## Notes

- The command creates directories as needed.
- Asset folder metadata is stored under `<path>/assets/<space>/folders`.
