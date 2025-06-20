# Migrations Generate Command

The `migrations generate` command allows you to create a migration file for a specific component in your Storyblok space.

## Basic Usage

```bash
storyblok migrations generate COMPONENT_NAME --space YOUR_SPACE_ID
```

This will generate a migration file for the specified component:
```
.storyblok/
└── migrations/
    └── YOUR_SPACE_ID/
        └── COMPONENT_NAME.js  # Migration file
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to generate the migration for | - |
| `--su, --suffix <suffix>` | Suffix to add to the file name (e.g., `{component-name}.{suffix}.js`) | - |
| `-p, --path <path>` | Custom path to store the migration file | `.storyblok/migrations` |

## Examples

1. Generate a migration for a component:
```bash
storyblok migrations generate hero --space 12345
```
Generates:
```
.storyblok/
└── migrations/
    └── 12345/
        └── hero.js  # Migration file
```

2. Generate a migration with a suffix:
```bash
storyblok migrations generate hero --space 12345 --suffix field-name-change
```
Generates:
```
.storyblok/
└── migrations/
    └── 12345/
        └── hero.field-name-change.js  # Migration file
```

3. Generate a migration in a custom path:
```bash
storyblok migrations generate hero --space 12345 --path ./backup
```
Generates:
```
backup/
└── migrations/
    └── 12345/
        └── hero.js  # Migration file
```

## File Structure

The command follows this pattern for file generation:
```
{path}/
└── migrations/
    └── {spaceId}/
        └── {componentName}.{suffix}.js  # Migration file
```

Where:
- `{path}` is the base path (default: `.storyblok`)
- `{spaceId}` is your Storyblok space ID
- `{componentName}` is the name of the component
- `{suffix}` is the suffix in the file name if provided

## Notes

- The space ID is required
- The component name is required
- The command will create the necessary directories if they don't exist
- The generated migration file contains a template with examples for common transformations:
  ```js
  export default function (block) {
    // Example to change a string to boolean
    // block.field_name = !!(block.field_name)

    // Example to transfer content from other field
    // block.target_field = block.source_field

    // Example to transform an array
    // block.array_field = block.array_field.map(item => ({ ...item, new_prop: 'value' }))

    // Example to combine fields
    // block.fullname = `${block.name} ${block.lastname}`

    return block;
  }
  ```
- The migration function receives a `block` parameter containing the component's data
- You can modify the block's fields and return the updated block
- Make sure to return the block at the end of the function
