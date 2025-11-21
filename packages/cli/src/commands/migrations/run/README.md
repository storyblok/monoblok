# Migrations Run Command

The `migrations run` command allows you to execute migrations on stories in your Storyblok space.

> [!NOTE]
> Before running migrations, you must create them by running the `migrations generate` command. See [migrations generate](./generate/README.md) for more details.

> [!NOTE]
> When running a migration, a snapshot of the story's content will be automatically created in the `.storyblok/migrations/{spaceId}/rollbacks` directory with a timestamp. These can be used to rollback changes if needed.

## Basic Usage

```bash
storyblok migrations run --space YOUR_SPACE_ID
```

This will run all migrations found in:
```
.storyblok/
└── migrations/
    └── YOUR_SPACE_ID/
        ├── hero.js
        ├── feature.js
        └── ...
```

## Run a Single Component Migration

```bash
storyblok migrations run COMPONENT_NAME --space YOUR_SPACE_ID
```

This will run migrations for the specified component:
```
.storyblok/
└── migrations/
    └── YOUR_SPACE_ID/
        └── COMPONENT_NAME.js
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --space <space>` | (Required) The ID of the space to run migrations in | - |
| `--fi, --filter <filter>` | Glob pattern to filter migration filenames (e.g., "hero*" will match all migration files starting with "hero") | - |
| `-d, --dry-run` | Preview changes without applying them to Storyblok | `false` |
| `-q, --query <query>` | Filter stories by content attributes using Storyblok filter query syntax (e.g., `--query="[highlighted][in]=true"`) | - |
| `--starts-with <path>` | Filter stories by path (e.g., `--starts-with="/en/blog/"`) | - |
| `--publish <publish>` | Publication mode: `all` (publish all stories), `published` (only publish stories that were already published), or `published-with-changes` (only publish stories that have unpublished changes) | - |
| `-p, --path <path>` | Custom path to read migration files from | `.storyblok/migrations` |

## Examples

1. Run all migrations:
```bash
storyblok migrations run --space 12345
```

2. Run migrations for a specific component:
```bash
storyblok migrations run hero --space 12345
```

3. Run migrations with a filter:
```bash
storyblok migrations run --space 12345 --filter "hero*"
```

4. Preview changes without applying them:
```bash
storyblok migrations run --space 12345 --dry-run
```

5. Run migrations and publish all stories:
```bash
storyblok migrations run --space 12345 --publish all
```

6. Run migrations and only publish stories that were already published:
```bash
storyblok migrations run --space 12345 --publish published
```

7. Run migrations and only publish stories that have unpublished changes:
```bash
storyblok migrations run --space 12345 --publish published-with-changes
```

8. Run migrations on stories in a specific path:
```bash
storyblok migrations run --space 12345 --starts-with "/en/blog/"
```

9. Run migrations on stories matching a query:
```bash
storyblok migrations run --space 12345 --query "[highlighted][in]=true"
```

## File Structure

The command reads from the following file structure:
```
{path}/
└── migrations/
    └── {spaceId}/
        ├── {componentName1}.js
        ├── {componentName2}.js
        └── ...
```

Where:
- `{path}` is the base path (default: `.storyblok`)
- `{spaceId}` is your Storyblok space ID
- `{componentName}` is the name of the component

## Notes

- The space ID is required
- The command will:
  - Read all migration files (or filtered by component/filter)
  - Find stories that use the components
  - Apply the migrations to the stories
  - Update the stories in Storyblok (unless `--dry-run` is used)
  - Create a snapshot of each story's content in `.storyblok/migrations/{spaceId}/rollbacks` with a timestamp for potential rollbacks
- Use `--dry-run` to preview changes before applying them
- Use `--publish` to control which stories are affected
- Use `--starts-with` and `--query` to filter which stories are affected
