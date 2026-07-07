# Components Push Command

The `components push` command allows you to upload components and their dependencies to your Storyblok space.

This command will automatically handle the following:
- Upload components
- Upload component groups
- Upload component presets
- Upload component tags
- Upload component whitelists
- Upload datasources (excluding datasource entries)

> [!NOTE]
> To completly update datasources and their entries, please pull the datasources first from the origin space and push them to the target space. Check the [datasources pull](../datasources/pull/README.md) and [datasources push](../datasources/push/README.md) commands for more information.

## Prerequisites

- You must have previously used the `components pull` command to download those components.
- If you have components with fields that depend on datasources, you must pull the datasources first from the origin space and push them to the target space using the `datasources pull` and `datasources push` commands. .
- If you used any flags during the pull (like `--suffix` or `--separate-files`), you must apply them with the same values when pushing to ensure files are found correctly.

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

| Option                    | Description                                                                                                    | Default                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `-s, --space <space>`     | (Required) The ID of the space to push components to                                                           | -                       |
| `-f, --from <from>`       | Source space ID to read components from                                                                        | Target space ID         |
| `--fi, --filter <filter>` | Glob pattern to filter components by their name (e.g., "hero*" will match all components starting with "hero") | -                       |
| `--gr, --group <name>`    | Component group name or `Parent/Child` path to select. Repeatable                                              | -                       |
| `--tg, --tag <name>`      | Component tag name to select. Repeatable and comma-separated                                                   | -                       |
| `--sf, --separate-files`  | Read from separate files instead of consolidated files                                                         | `false`                 |
| `--su, --suffix <suffix>` | Suffix to add to the files names                                                                               | -                       |
| `-p, --path <path>`       | Custom path to read the files from                                                                             | `.storyblok/components` |

## Selective push

`--filter`, `--group`, and `--tag` mirror the selectors on `components pull` and select which locally stored components to push, rather than pushing the whole file. Each selector accepts multiple values (`--group` is repeatable, `--tag` accepts a comma-separated list or repeated flags) that combine with OR, while different selectors combine with AND: a component must match every selector you provide.

- `--filter <glob>` selects components by name using a glob pattern, and also selects their dependencies: assigned groups (with ancestors), assigned tags, presets, and schema-whitelisted groups and tags.
- `--group <name>` selects components assigned to a group. Pass a plain name to match a group anywhere in the tree, or a `Parent/Child` path to disambiguate nested or duplicate group names. Matching a group includes its descendant groups.
- `--tag <name>` selects components carrying a tag.

Sibling components referenced through a `component_whitelist` field are not pushed automatically. If you push a selected slice to a different space, a `component_whitelist` entry can reference a component name that does not exist yet in the target space; this is harmless and resolves itself once you push the referenced component too.

Examples:

```bash
storyblok components push --space 12345 --group Checkout
```

```bash
storyblok components push --space 12345 --tag beta
```

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
  - Datasources (excluding datasource entries)
