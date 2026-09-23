# Migrations Apply Command

The `migrations apply` command applies content migrations to every story in a space that contains
one of the blocks the migration targets, and records the run so it can be undone.

A content migration is a TypeScript or JavaScript file that default-exports `defineMigration([…])`
from `@storyblok/schema/migrations`. Its identity is its filename, so the same migration is
recognizable across machines.

## Basic Usage

```bash
storyblok migrations apply --space YOUR_SPACE_ID
```

Applies every content migration found for the space. Pass a name to apply a single one:

```bash
storyblok migrations apply 0001-rename-card-title --space YOUR_SPACE_ID
```

## Options

| Option                  | Description                                                          | Default      |
| ----------------------- | -------------------------------------------------------------------- | ------------ |
| `-s, --space <space>`   | (Required) The ID of the space to apply migrations in                | -            |
| `-d, --dry-run`         | Report what would change without writing                             | `false`      |
| `--schema <entry-file>` | Schema entry file to check the migration's blocks and fields against | -            |
| `-p, --path <path>`     | Base path for migration files and run records                        | `.storyblok` |

`--dry-run` takes the same code path as a real run and stops short of the write, so its report is
evidence about what a real run would do.

## File Structure

```
{path}/
└── migrations/
    └── {spaceId}/
        ├── 0001-rename-card-title.ts        # the migration
        ├── 0001-rename-card-title.before.ts # optional schema snapshot, never applied
        ├── {runId}.json                     # the recorded run
        └── {runId}.patches.json             # the patches that undo it
```

## Refusals

A story is reported and left untouched, rather than written, when:

- It already contained repeated block ids. They would be renumbered on write, which would strand the
  record needed to undo the run. The content arrived that way; the migration is not the cause.
- The migration left blocks with a repeated or missing id, for the same reason.
- An op disagrees with itself on a second pass, so running the migration again would keep changing
  the story.

The other stories in the run are still applied and recorded.
