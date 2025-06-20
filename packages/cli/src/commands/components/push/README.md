# Components Push Command

The `components push` command allows you to upload components and their dependencies to your Storyblok space.

> [!WARNING]
> This command requires you have previously used the `components pull` command to download those components. If you used any flags during the pull (like `--suffix` or `--separate-files`), you must apply them with the same values when pushing to ensure files are found correctly.

## Basic Usage

```bash
storyblok components push --space YOUR_SPACE_ID
```

This will upload all components and their dependencies from:
```
.storyblok/
└── components/
    └── YOUR_SPACE_ID/
        ├── components.json      # All components
```

## Push a Single Component

```bash
storyblok components push COMPONENT_NAME --space YOUR_SPACE_ID
```

This will upload a single component and its dependencies from:
```
.storyblok/
└── components/
    └── YOUR_SPACE_ID/
        ├── COMPONENT_NAME.json  # Single component
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to push components to | - |
| `-f, --from <from>` | Source space ID to read components from | Target space ID |
| `--fi, --filter <filter>` | Glob pattern to filter components by their name (e.g., "hero*" will match all components starting with "hero") | - |
| `--sf, --separate-files` | Read from separate files instead of consolidated files | `false` |
| `--su, --suffix <suffix>` | Suffix to add to the files names | - |
| `-p, --path <path>` | Custom path to read the files from | `.storyblok/components` |

## Examples

1. Push all components with default settings:
```bash
storyblok components push --space 12345
```
Reads from:
```
.storyblok/
└── components/
    └── 12345/
        ├── components.json      # All components
```

2. Push a single component:
```bash
storyblok components push hero --space 12345
```
Reads from:
```
.storyblok/
└── components/
    └── 12345/
        ├── hero.json           # Single component
```

3. Push components with filter:
```bash
storyblok components push --space 12345 --filter "hero*"
```
Reads from:
```
.storyblok/
└── components/
    └── 12345/
        ├── components.json      # All components
```

4. Push components from a different space:
```bash
storyblok components push --space 12345 --from 67890
```
Reads from:
```
.storyblok/
└── components/
    └── 67890/
        ├── components.json      # All components
```

5. Push components from separate files:
```bash
storyblok components push --space 12345 --separate-files
```
Reads from:
```
.storyblok/
└── components/
    └── 12345/
        ├── hero.json           # Individual components
        ├── hero.presets.json   # Component presets
        ├── feature.json
        ├── feature.presets.json
        ├── ...
```

6. Push components from a custom path:
```bash
storyblok components push --space 12345 --path ./backup
```
Reads from:
```
backup/
└── components/
    └── 12345/
        ├── components.json      # All components
```

## File Structure

The command reads from the following file structure:
```
{path}/
└── components/
    └── {spaceId}/
        ├── components.{suffix}.json  # Components file
```

When using `--separate-files`:
```
{path}/
└── components/
    └── {spaceId}/
        ├── {componentName1}.{suffix}.json        # Individual components
        ├── {componentName1}.presets.json         # Component presets
        ├── {componentName2}.{suffix}.json
        ├── {componentName2}.presets.json
        ├── ...
```

Where:
- `{path}` is the base path (default: `.storyblok`)
- `{spaceId}` is your Storyblok space ID
- `{suffix}` is the suffix in the file name if provided
- `{componentName}` is the name of the component

## Notes

- The target space ID is required
- The command will read from the specified path
- When using `--separate-files` or single component, presets are read from separate files named `{componentName}.presets.json`
- The command uploads:
  - Components
  - Component groups
  - Component presets
  - Component tags
  - Component whitelists
