# Migrations Rollback Command

The `migrations rollback` command allows you to revert migrations that were previously applied to stories in your Storyblok space.

> [!NOTE]
> Before rolling back migrations, you need to have run migrations first using the `migrations run` command. This ensures that rollback snapshots are available in the `.storyblok/migrations/{spaceId}/rollbacks` directory. See [migrations run](./run/README.md) for more details.

## Basic Usage

```bash
storyblok migrations rollback MIGRATION_FILE --space YOUR_SPACE_ID
```

This will rollback the specified migration file:
```
.storyblok/
└── migrations/
    └── YOUR_SPACE_ID/
        └── rollbacks/
            └── MIGRATION_FILE.json
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to rollback migrations in | - |
| `-p, --path <path>` | Custom path to read migration files from | `.storyblok/migrations` |

## Examples

1. Rollback a specific migration:
```bash
storyblok migrations rollback migration-component.1746452866186.json --space 12345
```

## File Structure

The command reads from the following file structure:
```
{path}/
└── migrations/
    └── {spaceId}/
        └── rollbacks/
            └── {migrationFile}.json
```

Where:
- `{path}` is the base path (default: `.storyblok`)
- `{spaceId}` is your Storyblok space ID
- `{migrationFile}` is the name of the migration file to rollback

## Notes

- The space ID is required
- The migration file name is required
- The command will:
  - Read the rollback data from the specified file
  - Restore each story to its original state
  - Update the stories in Storyblok
