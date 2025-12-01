# Stories Pull Command

The `stories pull` command allows you to download stories from your Storyblok space.

## Basic Usage

```bash
storyblok stories pull --space YOUR_SPACE_ID
```

This will download all stories as `{slug}_{UUID}.json` files:
```
.storyblok/
└── stories/
    └── YOUR_SPACE_ID/
        ├── a-story_a1bb908e-3d91-4189-8c1d-d2a97c11ed38.json
        ├── b-story_acc69b70-1a03-4650-98c8-5d969daedf60.json
        └── c-story_93fa6d92-3d2a-48d2-93e8-407eb5ff20dc.json
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to pull stories from | - |
| `-d, --dry-run` | Preview changes without applying them to Storyblok | `false` |
| `-q, --query <query>` | Filter stories by content attributes using Storyblok filter query syntax | - |
| `--starts-with <path>` | Filter stories by path | - |

## Notes

- The space ID is required
- The command will create the necessary directories if they don't exist
