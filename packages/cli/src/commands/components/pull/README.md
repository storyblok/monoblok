# Components Pull Command

The `components pull` command allows you to download components and their dependencies from your Storyblok space.

## Basic Usage

```bash
storyblok components pull --space YOUR_SPACE_ID
```

This will download all components and their dependencies to consolidated files:
```
.storyblok/
└── components/
    └── YOUR_SPACE_ID/
        ├── components.json      # All components
        ├── groups.json         # Component groups
        ├── presets.json        # Component presets
        └── tags.json           # Component tags
```

> [!WARNING]
> The `--filename` option is ignored when using `--separate-files`. Each component will be saved with its own name.

## Pull a Single Component

```bash
storyblok components pull COMPONENT_NAME --space YOUR_SPACE_ID
```

This will download a single component and its dependencies to:
```
.storyblok/
└── components/
    └── YOUR_SPACE_ID/
        ├── COMPONENT_NAME.json  # Single component
        ├── groups.json         # Component groups
        ├── COMPONENT_NAME.presets.json        # Component presets
        └── tags.json           # Component tags
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to pull components from | - |
| `-f, --filename <filename>` | Custom name for the components file | `components` |
| `--sf, --separate-files` | Create a separate file for each component | `false` |
| `--su, --suffix <suffix>` | Suffix to add to the files names  | |
| `-p, --path <path>` | Custom path to store the files | `.storyblok/components` |

## Examples

1. Pull all components with default settings:
```bash
storyblok components pull --space 12345
```
Generates:
```
.storyblok/
└── components/
    └── 12345/
        ├── components.json      # All components
        ├── groups.json         # Component groups
        ├── presets.json        # Component presets
        └── tags.json           # Component tags
```

2. Pull a single component:
```bash
storyblok components pull hero --space 12345
```
Generates:
```
.storyblok/
└── components/
    └── 12345/
        ├── hero.json           # Single component
        ├── groups.json         # Component groups
        ├── hero.presets.json   # Component presets
        └── tags.json           # Component tags
```

3. Pull components with a custom file name:
```bash
storyblok components pull --space 12345 --filename my-components
```
Generates:
```
.storyblok/
└── components/
    └── 12345/
        ├── my-components.json  # All components
        ├── groups.json         # Component groups
        ├── presets.json        # Component presets
        └── tags.json           # Component tags
```

4. Pull components with custom suffix:
```bash
storyblok components pull --space 12345 --suffix dev
```
Generates:
```
.storyblok/
└── components/
    └── 12345/
        ├── components.dev.json  # All components
        ├── groups.json         # Component groups
        ├── presets.json        # Component presets
        └── tags.json           # Component tags
```

5. Pull components to separate files:
```bash
storyblok components pull --space 12345 --separate-files
```
Generates:
```
.storyblok/
└── components/
    └── 12345/
        ├── hero.json           # Individual components
        ├── hero.presets.json   # Component presets
        ├── feature.json
        ├── feature.presets.json
        ├── ...
        ├── groups.json         # Component groups
        └── tags.json           # Component tags
```

6. Pull components to a custom path:
```bash
storyblok components pull --space 12345 --path ./backup
```
Generates:
```
backup/
└── components/
    └── 12345/
        ├── components.json      # All components
        ├── groups.json         # Component groups
        ├── presets.json        # Component presets
        └── tags.json           # Component tags
```

## File Structure

The command follows this pattern for file generation:
```
{path}/
└── components/
    └── {spaceId}/
        ├── {filename}.{suffix}.json  # Components file
        ├── groups.json              # Component groups
        ├── presets.json             # Component presets
        └── tags.json                # Component tags
```

When using `--separate-files`:
```
{path}/
└── components/
    └── {spaceId}/
        ├── {componentName1}.json        # Individual components
        ├── {componentName1}.presets.json # Component presets
        ├── {componentName2}.json
        ├── {componentName2}.presets.json
        ├── ...
        ├── groups.json                  # Component groups
        └── tags.json                    # Component tags
```

Where:
- `{path}` is the base path (default: `.storyblok`)
- `{spaceId}` is your Storyblok Space ID
- `{filename}` is the name you specified (default: `components`)
- `{suffix}` is the suffix you specified (default: space ID)
- `{componentName}` is the name of the component

## Notes

- The space ID is required
- The command will create the necessary directories if they don't exist
- When using `--separate-files` or single component, presets are saved in separate files named `{componentName}.presets.json`
- The command downloads:
  - Components
  - Component groups
  - Component presets
  - Component tags
