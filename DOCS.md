# Staged docs: `migrations apply`, `list`, `undo`, and `client.releases`

Staged docs-site content for the CLI's content migration commands and the Management API client's
`releases` resource. Each section starts with a `target` marker naming the docs platform page and
heading it belongs to.

- **New pages:** `src/content/docs/docs/tooling/cli/migrations-apply.mdx`, `migrations-list.mdx`,
  and `migrations-undo.mdx`.
- **Navigation:** in `src/config/navigation/tooling.ts`, add these entries in alphabetical order
  among the `migrations` commands:

  ```ts
  { label: "migrations apply", link: "docs/tooling/cli/migrations-apply" },
  { label: "migrations list", link: "docs/tooling/cli/migrations-list" },
  { label: "migrations undo", link: "docs/tooling/cli/migrations-undo" },
  ```

- **Existing pages:** `src/content/docs/docs/tooling/cli/index.mdx` gets three link cards,
  `src/content/docs/docs/libraries/js/schema/migrations.mdx` gets a pointer to the CLI, and
  `src/content/docs/docs/libraries/js/management-api-client/index.mdx` gets the `releases` resource.

<!-- target: src/content/docs/docs/tooling/cli/migrations-apply.mdx (new page) -->

````mdx
---
title: "migrations apply"
description:
  "Applies typed content migrations to the stories in a Storyblok space and records each run so
  migrations undo can revert it."
---

Applies content migrations to the stories in a Storyblok space and records each run so
[`migrations undo`](/docs/tooling/cli/migrations-undo) can revert it. A **content migration** is a
file that default-exports `defineMigration([...])` from
[@storyblok/schema/migrations](/docs/libraries/js/schema/migrations).

## Prerequisites

- Content migration files in `.storyblok/migrations/<space-id>/`, named with a numeric prefix, for
  example `0001-rename-article-author.ts`.

## Usage

```bash
storyblok migrations apply [arguments] [flags]
```

## Arguments

| Argument       | Type   | Description                                                                                                                        |
| -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Migration name | string | _Optional._ The file name of a single migration without its extension. If omitted, every migration in the directory runs in order. |

## Flags

| Flag                       | Type    | Description                                                                                                                                                    |
| -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--space`, `-s`            | integer | _Required._ The ID of the Storyblok space to apply migrations to.                                                                                              |
| `--dry-run`, `-d`          | boolean | _Optional._ Report the stories and blocks each migration changes without writing them.                                                                         |
| `--schema`                 | string  | _Optional._ Path to a schema entry file. Checks the blocks and fields each migration names against the schema before any story is fetched.                     |
| `--publish`                | string  | _Optional._ Publish the migrated stories: `all`, `published` (only stories without unpublished changes), or `published-with-changes`. Defaults to drafts only. |
| `--allow-pending-releases` | boolean | _Optional._ Apply the migrations while releases are pending. The command lists the releases it doesn’t migrate.                                                |
| `--path`, `-p`             | string  | _Optional._ Base path for migration files and run records. Defaults to `.storyblok`.                                                                           |

## How a run works

The command runs the migrations in the order of their numeric prefix, so `2-...` runs before
`10-...`. Each migration only fetches the stories that contain a block it targets. Files named
`*.before.ts` are schema snapshots and never run.

A story is left unchanged and reported, rather than written, when the migration would lose data,
when the story already contains repeated block IDs, or when a second pass of the migration would
change the story again. The command still writes the other stories. It exits with an error only when
it refused every story it matched.

Every run that changed at least one story is recorded in `.storyblok/migrations/.journal/`. The
journal writes its own `.gitignore`, so run records stay local. A rerun of a migration that already
applied changes nothing and records nothing.

Write content migrations as `.ts` files. [`migrations run`](/docs/tooling/cli/migrations-run) reads
every `.js` file in the same directory.

## Pending releases

Content in a release is out of a migration’s reach, and deploying the release later replaces the
migrated story. The command refuses to run while any release in the space is pending and lists the
releases. Deploy or delete them first, or pass `--allow-pending-releases`. A dry run lists pending
releases without refusing.

## Publishing

By default, the command writes drafts. A published story then keeps its old content in the published
version until someone publishes it, and the command reports how many published stories this affects.
Pass `--publish` to publish the migrated stories along with the write.

## Examples

The following examples assume that a `space` has been defined in a configuration file.

```bash
# Preview every migration
storyblok migrations apply --dry-run

# Apply a single migration and check it against the schema first
storyblok migrations apply 0001-rename-article-author --schema src/schema.ts

# Apply every migration and publish stories that had no unpublished changes
storyblok migrations apply --publish published
```
````

<!-- target: src/content/docs/docs/tooling/cli/migrations-list.mdx (new page) -->

````mdx
---
title: "migrations list"
description:
  "Lists the content migration runs that migrations apply recorded for a Storyblok space."
---

Lists the content migration runs that [`migrations apply`](/docs/tooling/cli/migrations-apply)
recorded for a Storyblok space, oldest first. Each line shows the run ID, the migration, and the
number of stories and blocks the run changed.

## Usage

```bash
storyblok migrations list [flags]
```

## Flags

| Flag            | Type    | Description                                                                          |
| --------------- | ------- | ------------------------------------------------------------------------------------ |
| `--space`, `-s` | integer | _Required._ The ID of the Storyblok space to list runs for.                          |
| `--path`, `-p`  | string  | _Optional._ Base path for migration files and run records. Defaults to `.storyblok`. |

## Examples

The following example assumes that a `space` has been defined in a configuration file.

```bash
storyblok migrations list
```
````

<!-- target: src/content/docs/docs/tooling/cli/migrations-undo.mdx (new page) -->

````mdx
---
title: "migrations undo"
description:
  "Reverts a content migration run that migrations apply recorded, block by block, keeping edits
  made since the run."
---

Reverts a content migration run that [`migrations apply`](/docs/tooling/cli/migrations-apply)
recorded. The command restores each block the run changed, using the stories as they are now, so
edits made since the run are kept.

## Usage

```bash
storyblok migrations undo [flags]
```

## Flags

| Flag                       | Type    | Description                                                                                                                                  |
| -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `--space`, `-s`            | integer | _Required._ The ID of the Storyblok space to undo the run in.                                                                                |
| `--run`                    | string  | _Optional._ The ID of the run to undo, as [`migrations list`](/docs/tooling/cli/migrations-list) prints it. Defaults to the most recent run. |
| `--force`                  | boolean | _Optional._ Overwrite blocks that were edited since the run. The command lists them before it writes.                                        |
| `--allow-pending-releases` | boolean | _Optional._ Undo the run while releases are pending. The command lists the releases it doesn’t restore.                                      |
| `--path`, `-p`             | string  | _Optional._ Base path for migration files and run records. Defaults to `.storyblok`.                                                         |

## Conflicts

The block is the unit of conflict. When a block the run changed was edited since, the command leaves
that block as it is and reports it, and still restores the other blocks in the story. Pass `--force`
to overwrite the edited blocks too.

The command also reports blocks that are no longer in the story and stories it can’t read, for
example because they were deleted.

## Publishing

The command republishes a story the run published only if the story is still published and has no
unpublished changes. Otherwise, it restores the draft and lists the story. A story the run published
for the first time keeps its published state; unpublish it if it shouldn’t be live.

## Examples

The following examples assume that a `space` has been defined in a configuration file.

```bash
# Undo the most recent run
storyblok migrations undo

# Undo a specific run and overwrite blocks edited since
storyblok migrations undo --run 2026-10-07T14-03-12-511Z-0001-rename-article-author --force
```
````

<!-- target: src/content/docs/docs/tooling/cli/index.mdx (link cards, after the `logs prune` card) -->

```mdx
<LinkCard
  description="Apply typed content migrations and record each run. Read when reshaping content after a schema change."
  href="/docs/tooling/cli/migrations-apply"
  title="migrations apply"
/>
```

```mdx
<LinkCard
  description="List the content migration runs recorded for a space. Read when picking a run to undo."
  href="/docs/tooling/cli/migrations-list"
  title="migrations list"
/>
```

<!-- target: src/content/docs/docs/tooling/cli/index.mdx (link card, after the `migrations run` card) -->

```mdx
<LinkCard
  description="Revert a recorded content migration run block by block. Read when a migration produced the wrong result."
  href="/docs/tooling/cli/migrations-undo"
  title="migrations undo"
/>
```

<!-- target: src/content/docs/docs/libraries/js/schema/migrations.mdx#usage (before "Apply migrations") -->

```mdx
<Aside type="tip">
  The Storyblok CLI wraps these steps in [`migrations apply`](/docs/tooling/cli/migrations-apply)
  and [`migrations undo`](/docs/tooling/cli/migrations-undo). Use the engine directly to run
  migrations from your own code.
</Aside>
```

<!-- target: src/content/docs/docs/libraries/js/management-api-client/index.mdx (after `client.presets`) -->

````mdx
### `client.releases`

Use the `releases` resource client to read the releases in a space. A release groups story changes
to publish together.

```ts
client.releases.list(options?);
```

Pass `query.branch_id` to list only the releases of one branch.
````

<!-- target: src/content/docs/docs/libraries/js/management-api-client/index.mdx (introduction) -->

In the introduction’s list of resource clients, add `releases` after `presets`.
