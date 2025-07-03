# `datasources pull`

Download datasources and their entries from your Storyblok space.

## Basic Usage

```sh
monoblok datasources pull --space <SPACE_ID>
```

This will download all datasources and their entries to a consolidated file:
```
.storyblok/
└── datasources/
    └── <SPACE_ID>/
        └── datasources.json      # All datasources with entries
```

> [!WARNING]
> The `--filename` option is ignored when using `--separate-files`. Each datasource will be saved with its own name.

## Pull a Single Datasource

```sh
monoblok datasources pull <DATASOURCE_NAME> --space <SPACE_ID>
```

This will download a single datasource and its entries to:
```
.storyblok/
└── datasources/
    └── <SPACE_ID>/
        └── <DATASOURCE_NAME>.json  # Single datasource with entries
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to pull datasources from | - |
| `-f, --filename <filename>` | Custom name for the datasources file | `datasources` |
| `--sf, --separate-files` | Create a separate file for each datasource | `false` |
| `--su, --suffix <suffix>` | Suffix to add to the files names  | |
| `-p, --path <path>` | Custom path to store the files | `.storyblok/datasources` |

## Examples

### Pull all datasources with default settings
```sh
monoblok datasources pull --space 12345
```
Generates:
```
.storyblok/
└── datasources/
    └── 12345/
        └── datasources.json      # All datasources with entries
```

### Pull datasources with a custom file name
```sh
monoblok datasources pull --space 12345 --filename my-datasources
```
Generates:
```
.storyblok/
└── datasources/
    └── 12345/
        └── my-datasources.json  # All datasources with entries
```

### Pull datasources with custom suffix
```sh
monoblok datasources pull --space 12345 --suffix dev
```
Generates:
```
.storyblok/
└── datasources/
    └── 12345/
        └── datasources.dev.json  # All datasources with entries
```

### Pull datasources to separate files
```sh
monoblok datasources pull --space 12345 --separate-files
```
Generates:
```
.storyblok/
└── datasources/
    └── 12345/
        ├── colors.json           # Individual datasources with entries
        └── numbers.json
```

### Pull datasources to a custom path
```sh
monoblok datasources pull --space 12345 --path ./backup
```
Generates:
```
backup/
└── datasources/
    └── 12345/
        └── datasources.json      # All datasources with entries
```

## File Structure

The command follows this pattern for file generation:
```
{path}/
└── datasources/
    └── {spaceId}/
        └── {filename}.{suffix}.json  # Datasources file (all datasources with entries)
```

When using `--separate-files` or pulling a single datasource:
```
{path}/
└── datasources/
    └── {spaceId}/
        ├── {datasourceName1}.json   # Individual datasources with entries
        ├── {datasourceName2}.json
        └── ...
```

Where:
- `{path}` is the base path (default: `.storyblok`)
- `{spaceId}` is your Storyblok Space ID
- `{filename}` is the name you specified (default: `datasources`)
- `{suffix}` is the suffix you specified (default: space ID)
- `{datasourceName}` is the name of the datasource

## Notes

- The space ID is required
- The command will create the necessary directories if they don't exist
- When using `--separate-files` or single datasource, each datasource is saved in its own file
- All files include the datasource entries resolved automatically
