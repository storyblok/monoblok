# Languages Command

The `languages` command allows you to pull the available languages in your Storyblok space.

## Basic Usage

```bash
storyblok languages pull --space YOUR_SPACE_ID
```

This will download your space's languages configuration and save it to:
```
.storyblok/
└── languages/
    └── YOUR_SPACE_ID/
        └── languages.json
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to pull languages from | - |
| `-f, --filename <filename>` | Custom name for the languages file | `languages` |
| `--su, --suffix <suffix>` | Suffix to add to the file name |  |
| `-p, --path <path>` | Custom path to store the file | `.storyblok/languages` |

## Examples

1. Pull languages with default settings:
```bash
storyblok languages pull --space 12345
```
Generates:
```
.storyblok/
└── languages/
    └── 12345/
        └── languages.json
```

2. Pull languages with custom filename:
```bash
storyblok languages pull --space 12345 --filename my-languages
```
Generates:
```
.storyblok/
└── languages/
    └── 12345/
        └── my-languages.json
```

3. Pull languages with custom suffix:
```bash
storyblok languages pull --space 12345 --suffix dev
```
Generates:
```
.storyblok/
└── languages/
    └── 12345/
        └── languages.dev.json
```

4. Pull languages to a custom path:
```bash
storyblok languages pull --space 12345 --path ./backup
```
Generates:
```
backup/
└── languages/
    └── 12345/
        └── languages.json
```

## File Structure

The command follows this pattern for file generation:
```
{path}/
└── languages/
    └── {spaceId}/
        └── {filename}.{suffix}.json
```

Where:
- `{path}` is the base path (default: `.storyblok`)
- `{spaceId}` is your Storyblok space ID
- `{filename}` is the name you specified (default: `languages`)
- `{suffix}` is the suffix you specified (default: space ID)

## Notes

- The space ID is required
- The command will create the necessary directories if they don't exist
- The generated file follows the Storyblok languages schema
- The file can be used for version control or backup purposes
