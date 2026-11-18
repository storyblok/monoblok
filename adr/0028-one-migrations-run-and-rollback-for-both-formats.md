# ADR-0026: One `migrations run` and `rollback` for Both Migration Formats

**Status:** Accepted. **Date:** 2026-11-09

## Context

The CLI has two migration formats. **Migration functions** are `.js` files that default-export a
function called for each block of one component; `migrations run` applies them and saves whole
stories to a `.jsonl` rollback file that `migrations rollback` restores. **Content migrations**
default-export `defineMigration()` from `@storyblok/schema`, describe their changes as typed ops,
and are applied through block patches with recorded inverses.

Content migrations were first given their own commands, `migrations apply` and `migrations undo`.
That left two commands per verb, a `schema push --typed && migrations run` script that silently
migrated nothing, and a pair of commands to deprecate once migration functions go away.

## Decisions

### 1. `run` and `rollback` take both formats

`migrations run` applies migration functions, then content migrations. `migrations rollback`
restores a rollback file or rolls back a recorded content migration run. There is no `apply` or
`undo`. The two formats keep their own semantics: a rollback file overwrites whole stories, a
content migration run is rolled back block by block with conflict detection. Running both formats in
one invocation has no defined order between them beyond "functions first"; a space is not expected
to mix them for the same blocks.

### 2. A file's format is its default export

Every `.js` file in a space's migrations directory is a migration function unless its default export
is a content migration, and every file the engine discovers by name (`<number>-<name>`) is a content
migration unless it is a `.js` file exporting a function. The file name decides which files are
considered at all, never which format a file has, so a component named `0001-hero` keeps working.

### 3. The API is the one we would build without migration functions

Where the formats need different flags, the command takes the content migration shape and the
migration function path adapts:

- `rollback [run]` takes a run as its only positional argument: a recorded run id or a rollback file
  name. Without one, it rolls back the latest content migration run; rollback files carry no rolled
  back state, so they are never picked by default. There is no `--run` flag.
- The positional argument of `run` selects the migration functions of a component and the content
  migration with that id.
- `--filter` matches migration function file names and content migration ids.
- `--query`, `--starts-with`, and `--from` apply to both formats.

### 4. New safety behavior applies to both formats

The pending release check, the `--publish` value check, and failing on an unknown migration name
apply to migration functions too. Scripts that relied on `run` succeeding with a pending release or
an unknown component name now fail.

### 5. One directory for every run record

Content migration runs are recorded in `migrations/<space>/rollbacks/`, beside the rollback files,
so `migrations list` shows both kinds of run from one place. The two are told apart by extension:
`.jsonl` for rollback files, `.json` for run records and their patches. The journal's `.gitignore`
ignores `*.json` only, so rollback files stay as visible to git as before.

## Consequences

- Removing migration functions later deletes a code path instead of a command.
- The `run` and `rollback` help and docs describe two formats until then.
- `rollback --force` has no effect on rollback files, which always overwrite.
