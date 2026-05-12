# `storyblok schema` Reference

`storyblok schema` is the Storyblok CLI command group for managing a space's schema (components, component folders, and datasources) from code. It reads a local TypeScript schema authored with `@storyblok/schema`, diffs it against the remote space, and applies the changes through the Management API.

## Requirements

This command ships with the `storyblok` CLI and requires Node.js 18 or above.

A local schema written with `@storyblok/schema` is required for `schema push`. Install it in the project that exports the schema:

```bash
npm i @storyblok/schema
```

An authenticated CLI session is required for every subcommand. Run `storyblok login` first.

A Storyblok space ID is required for every subcommand and can be passed via `--space <id>` or configured globally.

## Example

A typical workflow starts by bootstrapping a code-driven schema from an existing space and then iterating on it locally:

```bash
# Bootstrap a local TypeScript schema from an existing space.
storyblok schema init --space 12345

# Edit files under .storyblok/schema/ (or your --out-dir),
# then push the local schema back to the space.
storyblok schema push .storyblok/schema/schema.ts --space 12345

# Roll back the last push if something went wrong.
storyblok schema rollback --latest --space 12345
```

## Subcommands

`storyblok schema` groups three subcommands:

- `storyblok schema init`: One-time bootstrap of a local TypeScript schema from an existing space.
- `storyblok schema push <entry-file>`: Push a local schema to a space, optionally generating migration scaffolds for breaking changes.
- `storyblok schema rollback [changeset-file]`: Roll a space back to the state captured in a previous `push` changeset.

### storyblok schema init

```bash
storyblok schema init [options]
```

Fetches the current schema of a space and writes it as TypeScript files using `@storyblok/schema` helpers. The command refuses to overwrite a non-empty target directory: it is a one-time bootstrap step for adopting an existing space, not an ongoing sync.

```bash
storyblok schema init --space 12345 --out-dir .storyblok/schema
```

After bootstrapping, treat the local files as the source of truth and use `schema push` for further changes.

`storyblok schema init` accepts the following options:

| Option | Description |
| --- | --- |
| `-s, --space <space>` | The space ID to read from. Required. |
| `--out-dir <dir>` | Output directory for generated files. Defaults to `.storyblok/schema`. |

The output includes one file per component, plus aggregate files for component folders, datasources, and a root `schema.ts` that wires everything into a single exported `schema` object.

### storyblok schema push

```bash
storyblok schema push <entry-file> [options]
```

Loads the schema exported from `<entry-file>`, fetches the current remote state, prints a diff, and applies the changes. Each successful run saves a changeset file under the configured base path so the push can be rolled back later.

```bash
storyblok schema push .storyblok/schema/schema.ts --space 12345
storyblok schema push .storyblok/schema/schema.ts --space 12345 --dry-run
storyblok schema push .storyblok/schema/schema.ts --space 12345 --delete
```

The entry file must `export const schema = { blocks, blockFolders?, datasources? }` (the same shape consumed by `Schema<typeof schema>` in `@storyblok/schema`).

`storyblok schema push` accepts the following options:

| Option | Description |
| --- | --- |
| `-s, --space <space>` | The space ID to push to. Required. |
| `-p, --path <path>` | Base path for changeset and migration files. |
| `--dry-run` | Show diffs without applying changes. |
| `--delete` | Delete remote entities that are not present in the local schema. Stories using deleted components will end up with out-of-schema content. |
| `--migrations` | Generate scaffold migration files for breaking changes. Enabled by default. |
| `--no-migrations` | Skip migration generation for breaking changes. |
| `--write-components` | Write component schemas as local JSON files after push (and remove the files of components deleted via `--delete`). Enabled by default. |
| `--no-write-components` | Skip writing local component files. |

#### Breaking changes and migrations

When a push contains breaking changes (field removals, type changes, or renames), the command analyzes them and, unless `--no-migrations` is set, generates scaffold migration files. Detected renames are confirmed interactively. The generated migrations are scaffolds: review them before running `storyblok migrations run --space <id>`.

When `--dry-run` is set the analysis is printed but no migration files are written.

#### Changesets

Every non-dry-run push writes a changeset file capturing the diff and the pre-push remote state. The changeset is the input consumed by `storyblok schema rollback`.

#### Local component files

With `--write-components` (the default), `schema push` writes each component schema to disk after a successful push, even when nothing changed. This keeps a fresh checkout in sync without requiring an extra `storyblok components pull` step. Pair the flag with `--delete` to also remove the local files of components that were deleted remotely.

### storyblok schema rollback

```bash
storyblok schema rollback [changeset-file] [options]
```

Loads a changeset written by a previous `schema push` and reverts the space to the state captured before that push. If no `changeset-file` is passed, the command lists available changesets and prompts for one, unless `--latest` selects the most recent automatically.

```bash
storyblok schema rollback --latest --space 12345
storyblok schema rollback .storyblok/changesets/2026-05-11T10-00-00Z.json --space 12345
storyblok schema rollback --latest --space 12345 --dry-run
```

`storyblok schema rollback` accepts the following options:

| Option | Description |
| --- | --- |
| `-s, --space <space>` | The space ID to roll back. Required. |
| `-p, --path <path>` | Base path where changesets are stored. |
| `--dry-run` | Show what would be undone without applying changes. |
| `--yes` | Skip the interactive confirmation prompt. |
| `--latest` | Automatically select the most recent changeset. |

Applying a rollback writes a new changeset capturing the rollback operation itself, so a rollback can be rolled back.

## Datasources and entries

`storyblok schema push` owns datasource definitions: it creates, updates, and (with `--delete`) removes datasources in the space. Datasource entries are out of scope for `schema push`. Use `storyblok datasources push` to sync entries after the datasource definition exists.

## Workflow notes

The recommended flow keeps the local schema as the source of truth:

1. Run `storyblok schema init` once to adopt an existing space.
2. Edit the generated TypeScript files using `@storyblok/schema` helpers.
3. Run `storyblok schema push <entry-file> --dry-run` to preview changes.
4. Run `storyblok schema push <entry-file>` to apply them.
5. Run any generated migrations with `storyblok migrations run --space <id>` once reviewed.
6. Use `storyblok schema rollback --latest` if a push needs to be reverted.

The `--space`, `--path`, and `--verbose` global CLI options apply to every subcommand and can be set via environment or configuration in the same way as the rest of the `storyblok` CLI.
