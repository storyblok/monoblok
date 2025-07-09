# Datasources Push Command

The `datasources push` command allows you to upload datasources and their entries to your Storyblok space.

> [!WARNING]
> This command requires you have previously used the `datasources pull` command to download those datasources. If you used any flags during the pull (like `--suffix` or `--separate-files`), you must apply them with the same values when pushing to ensure files are found correctly.

## Basic Usage

```bash
storyblok datasources push --space YOUR_SPACE_ID
```

This will upload all datasources and their entries from:
```
.storyblok/
└── datasources/
    └── YOUR_SPACE_ID/
        ├── datasources.json      # All datasources with entries
```

## Push a Single Datasource

```bash
storyblok datasources push DATASOURCE_NAME --space YOUR_SPACE_ID
```

This will upload a single datasource and its entries from:
```
.storyblok/
└── datasources/
    └── YOUR_SPACE_ID/
        ├── DATASOURCE_NAME.json  # Single datasource with entries
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to push datasources to | - |
| `-f, --from <from>` | Source space ID to read datasources from | Target space ID |
| `--fi, --filter <filter>` | Filter to apply to datasources by their name (e.g., "color" will match datasources containing "color") | - |
| `--sf, --separate-files` | Read from separate files instead of consolidated files | `false` |
| `--su, --suffix <suffix>` | Suffix to add to the files names | - |
| `-p, --path <path>` | Custom path to read the files from | `.storyblok/datasources` |

## Examples

1. Push all datasources with default settings:
```bash
storyblok datasources push --space 12345
```
Reads from:
```
.storyblok/
└── datasources/
    └── 12345/
        ├── datasources.json      # All datasources with entries
```

2. Push a single datasource:
```bash
storyblok datasources push colors --space 12345
```
Reads from:
```
.storyblok/
└── datasources/
    └── 12345/
        ├── colors.json           # Single datasource with entries
```

3. Push datasources with filter:
```bash
storyblok datasources push --space 12345 --filter "color"
```
Reads from:
```
.storyblok/
└── datasources/
    └── 12345/
        ├── datasources.json      # All datasources with entries (filtered by name)
```

4. Push datasources from a different space:
```bash
storyblok datasources push --space 12345 --from 67890
```
Reads from:
```
.storyblok/
└── datasources/
    └── 67890/
        ├── datasources.json      # All datasources with entries
```

5. Push datasources from separate files:
```bash
storyblok datasources push --space 12345 --separate-files
```
Reads from:
```
.storyblok/
└── datasources/
    └── 12345/
        ├── colors.json           # Individual datasources with entries
        ├── categories.json
        ├── countries.json
        ├── ...
```

6. Push datasources with suffix:
```bash
storyblok datasources push --space 12345 --suffix dev
```
Reads from:
```
.storyblok/
└── datasources/
    └── 12345/
        ├── datasources.dev.json  # All datasources with entries
```

7. Push datasources from a custom path:
```bash
storyblok datasources push --space 12345 --path ./backup
```
Reads from:
```
backup/
└── datasources/
    └── 12345/
        ├── datasources.json      # All datasources with entries
```

## File Structure

The command reads from the following file structure:
```
{path}/
└── datasources/
    └── {spaceId}/
        ├── datasources.{suffix}.json  # Datasources file with entries
```

When using `--separate-files`:
```
{path}/
└── datasources/
    └── {spaceId}/
        ├── {datasourceName1}.{suffix}.json        # Individual datasources with entries
        ├── {datasourceName2}.{suffix}.json
        ├── ...
```

Where:
- `{path}` is the base path (default: `.storyblok`)
- `{spaceId}` is your Storyblok space ID
- `{suffix}` is the suffix in the file name if provided
- `{datasourceName}` is the name of the datasource

## Behavior

The command performs the following operations:

1. **Upsert Datasources**: Creates new datasources or updates existing ones based on name matching
2. **Upsert Entries**: Creates new entries or updates existing ones for each datasource
3. **Progress Tracking**: Shows individual progress for each datasource being pushed
4. **Error Handling**: Continues processing other datasources if one fails

## Data Structure

Each datasource file contains:
- **Datasource metadata**: `id`, `name`, `slug`, `dimensions`, timestamps
- **Entries**: Array of datasource entries with `id`, `name`, `value`, `dimension_value`

Example datasource file:
```json
{
  "id": 1,
  "name": "colors",
  "slug": "colors",
  "dimensions": [],
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z",
  "entries": [
    {
      "id": 101,
      "name": "blue",
      "value": "#0000ff",
      "dimension_value": "",
      "datasource_id": 1
    }
  ]
}
```

## Notes

- The target space ID is required
- The command will read from the specified path and source space
- Datasources are matched by name for updates
- Entries are matched by name within each datasource for updates
- The command uploads both datasources and their associated entries
- If no source space is specified (`--from`), it uses the target space as the source

## Common Use Cases

### Copy datasources between spaces
```bash
# Pull from production space
storyblok datasources pull --space 12345

# Push to staging space
storyblok datasources push --space 67890 --from 12345
```

### Update specific datasources
```bash
# Push only color-related datasources
storyblok datasources push --space 12345 --filter "color"
```

### Work with separate files
```bash
# If you pulled with separate files, push with the same flag
storyblok datasources push --space 12345 --separate-files
``` 

## ⚠️ Known Caveats

### Entry Name Dependencies
- **Cross-space operations**: If you modify the `name` property of a datasource entry when pushing between different spaces, this will create a **new entry** instead of updating the existing one
- **Reason**: Since datasource entry IDs are different between spaces, the `name` field is the only reliable property for matching entries across spaces
- **Recommendation**: Avoid changing entry names when copying datasources between spaces, or manually clean up duplicate entries afterward

### Matching Logic
- **Datasources**: Matched by `name` field for upserts
- **Entries**: Matched by `name` field within each datasource for upserts
- **IDs**: Local file IDs are ignored during push operations (server assigns new IDs)

### File Consistency
- Must use the same flags (`--suffix`, `--separate-files`) as used during the original `pull` operation
- Command expects files to exist in the exact structure created by `datasources pull`
