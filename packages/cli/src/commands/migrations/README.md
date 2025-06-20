# Migrations Command

The `migrations` module provides tools to manage and execute migrations for your Storyblok components. Migrations are useful for making changes to existing stories in your space, such as updating component structures or content.

## Subcommands

- [`generate`](./generate/README.md): Create a new migration file for a specific component.
- [`run`](./run/README.md): Execute migrations on stories in your space.
- [`rollback`](./rollback/README.md): Revert previously applied migrations.

> See each subcommand for detailed usage, options, and examples.

## Workflow

1. **Generate** a migration file for the component you want to modify
2. **Run** the migration to apply changes to your stories
3. If needed, **Rollback** the migration to revert changes

## File Structure

All migration files are stored in:
```
.storyblok/
└── migrations/
    └── YOUR_SPACE_ID/
        ├── component1.js
        ├── component2.js
        └── ...
```

## Notes

- You must be logged in to use any migration command
- The space ID is required for all commands
- Use `--dry-run` to preview changes before applying them
- Migration files should include both forward and rollback logic
- Use filters and queries to target specific stories when running migrations
