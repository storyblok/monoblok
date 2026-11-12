# Migrations Command

The `migrations` module provides tools to manage and execute migrations for your Storyblok
components. Migrations are useful for making changes to existing stories in your space, such as
updating component structures or content.

## Subcommands

- [`generate`](./generate/README.md): Create a new migration file for a specific component.
- [`run`](./run/README.md): Run migration functions and typed content migrations on the stories in
  your space.
- [`rollback`](./rollback/README.md): Revert a migration run.
- `list`: List the migration runs that can be rolled back.

Typed content migrations are `.ts`, `.js`, or `.mjs` files named `<number>-<name>` that
default-export `defineMigration()` from `@storyblok/schema`. A `.js` file is told apart from a
migration function by its default export.

> See each subcommand for detailed usage, options, and examples.

## Workflow

1. **Generate** a migration file for the component you want to modify
2. **Run** the migration to apply changes to your stories
3. If needed, **Rollback** the migration to revert changes

Content migrations follow the same **run**, then **rollback** workflow.

## File Structure

All migration files are stored in:

```
.storyblok/
└── migrations/
    └── YOUR_SPACE_ID/
        ├── component1.js
        ├── component2.js
        ├── 0001-rename-card-title.ts   # content migration
        └── ...
```

Each run is recorded in `.storyblok/migrations/YOUR_SPACE_ID/rollbacks/`: a `.jsonl` file of whole
stories for migration functions, and git-ignored `.json` records of block patches for content
migrations.

## Notes

- You must be logged in to use any migration command except `list`
- The space ID is required for all commands
- Use `--dry-run` to preview changes before applying them
- Migration files should include both forward and rollback logic
- Use filters and queries to target specific stories when running migrations
