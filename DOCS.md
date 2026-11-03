# Staged docs: `migrations apply`, `list`, `undo`, and `client.releases`

Staged docs-site content for the CLI’s content migration commands and the Management API client’s
`releases` resource. Each section starts with a `target` marker naming the docs platform page and
heading it belongs to.

- **New pages:** `src/content/docs/docs/tooling/cli/migrations/apply.mdx`, `list.mdx`, and
  `undo.mdx`.
- **Navigation:** in `src/config/navigation/tooling.ts`, add these entries to the `migrations`
  group, keeping its items in alphabetical order:

  ```ts
  { label: "apply", link: "docs/tooling/cli/migrations/apply" },
  { label: "list", link: "docs/tooling/cli/migrations/list" },
  { label: "undo", link: "docs/tooling/cli/migrations/undo" },
  ```

- **Existing pages:** `tooling/cli/index.mdx` gets three link cards, `libraries/js/schema/index.mdx`
  gets a pointer to the CLI, and `libraries/js/management-api-client/index.mdx` gets the `releases`
  resource.

<!-- target: src/content/docs/docs/tooling/cli/migrations/apply.mdx (new page) -->

````mdx
---
title: "migrations apply"
description:
  "Applies typed content migrations to the stories in a Storyblok space and records each run, so
  migrations undo can revert it."
---

Applies content migrations to the stories in a Storyblok space and records each run, so
[`migrations undo`](/docs/tooling/cli/migrations/undo) can revert it. A **content migration** is a
file that default-exports `defineMigration()` from
[@storyblok/schema](/docs/libraries/js/schema#content-migrations).

## Prerequisites

- Content migration files in `.storyblok/migrations/<space-id>/`, named `<number>-<name>.ts`, `.js`,
  or `.mjs`, where `<name>` holds lowercase letters, digits, and hyphens, for example
  `20261029141150-rename-twitter-to-x.ts`. The command ignores other files.

## Usage

```bash
storyblok migrations apply [arguments] [flags]
```

## Arguments

| Argument       | Type   | Description                                                                                                           |
| -------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| Migration name | string | _Optional._ The file name of one migration, with or without its extension. If omitted, every migration runs in order. |

## Flags

| Flag                       | Type    | Description                                                                                                                                                             |
| -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--space`, `-s`            | integer | _Required._ The ID of the Storyblok space to apply migrations to.                                                                                                       |
| `--dry-run`, `-d`          | boolean | _Optional._ Report the stories and blocks each migration changes without writing them.                                                                                  |
| `--schema`                 | string  | _Optional._ Path to a schema entry file describing the schema before the migration. Checks the migration against it instead of its snapshot. Requires a migration name. |
| `--no-validate`            | boolean | _Optional._ Skip checking each migration against its `.before.ts` snapshot.                                                                                             |
| `--publish`                | string  | _Optional._ Publish the migrated stories. See [Publishing](#publishing). Defaults to drafts only.                                                                       |
| `--allow-pending-releases` | boolean | _Optional._ Apply the migrations while releases are pending. The command lists the releases it doesn’t migrate.                                                         |
| `--path`, `-p`             | string  | _Optional._ Base path for migration files and run records. Defaults to `.storyblok`.                                                                                    |

## How a run works

The command runs the migrations in the order of their numeric prefix, so `2-...` runs before
`10-...`, and fetches only the stories that contain a block a migration targets. Files named
`*.before.ts` are schema snapshots and never run.

The command writes a story only when every op succeeds on it. It skips and reports a story when an
op would lose data or its callback throws, when the story already holds repeated block IDs, or when
a second pass would change the story again:

```text
✔ 20261029142718-split-metric-value: 32 stories contain metric
⚠️  a/storyblok-vs-sitecore: op 0 (splitField) on block 6a7a6e9a-… was refused: the callback threw: metric value "CX " holds no amount
```

The command exits with an error when a migration skipped every story it matched, or when a story
couldn’t be read or written.

Before the first write, the command records the run in `.storyblok/migrations/.journal/`, so a run
that stops partway can still be undone. It then narrows the record to the stories that changed.
[`migrations list`](/docs/tooling/cli/migrations/list) shows a run that stopped partway as
interrupted. The journal writes its own `.gitignore`, so run records stay on the machine that ran
them. A rerun of a migration that already applied changes nothing and records nothing.

[`migrations run`](/docs/tooling/cli/migrations/run) loads every `.js` file in the same directory
and reports each `.js` content migration as an error. In a space that uses both commands, write
content migrations as `.ts` or `.mjs`.

## Schema check

Before it fetches any story, the command checks each migration against its `.before.ts` snapshot,
the schema as it was before the migration. It stops when a migration names a block or field the
snapshot doesn’t define, renames a field or block onto one that exists, or wraps blocks in an
existing block that lacks the target field, and it reports the mismatches of every migration. A
migration without a snapshot runs unchecked with a warning. Pass `--schema` to check a single
migration against another schema entry file, or `--no-validate` to skip the check.

A snapshot’s `nameOnlyBlocks` export lists blocks that exist in the space but whose fields it
doesn’t describe. An op that reads their fields stops the command. Wrapping blocks in or unwrapping
them from one of them only warns.

## Pending releases

The command changes the current version of each story, not the content in releases, so deploying a
release later overwrites the migrated story. The command refuses to run while a release is pending
and lists it. Deploy or delete the release first, or pass `--allow-pending-releases`. A dry run
lists pending releases without refusing.

The check sees only the releases your account can access, and not releases of a pipeline branch. If
the command can’t list the releases, it stops, unless you pass `--allow-pending-releases` or
`--dry-run`.

## Publishing

By default, the command writes drafts, and reports how many published stories keep their old content
in the published version. Pass `--publish` with one of these modes to publish along with the write:

- `all`: every migrated story, including stories that were never published.
- `published`: published stories without unpublished changes.
- `published-with-changes`: published stories with unpublished changes, which also publishes those
  changes.

When the space saves a draft but refuses to publish it, for example because the content misses a
field the schema now requires, the command keeps and records the draft, names the story, and exits
with an error.

## Examples

The following examples assume that a `space` has been defined in a configuration file.

```bash
# Preview a migration
storyblok migrations apply 20261029141150-rename-twitter-to-x --dry-run

# Apply it and publish the stories that had no unpublished changes
storyblok migrations apply 20261029141150-rename-twitter-to-x --publish published

# Apply every migration
storyblok migrations apply
```
````

<!-- target: src/content/docs/docs/tooling/cli/migrations/list.mdx (new page) -->

````mdx
---
title: "migrations list"
description:
  "Lists the content migration runs that migrations apply recorded for a Storyblok space."
---

Lists the content migration runs that [`migrations apply`](/docs/tooling/cli/migrations/apply)
recorded for a Storyblok space, oldest first. Each run shows its ID, the migration title, and the
stories and blocks it changed:

```text
ℹ 2026-10-29T13-32-45-737Z-20261029132727-rename-teaser-to-excerpt  Rename teaser to excerpt on blog entries and events  478 stories, 478 blocks
```

A run also shows when it was undone, partly undone, or interrupted. The command reads local records
only and doesn’t require a login.

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

The following examples assume that a `space` has been defined in a configuration file.

```bash
storyblok migrations list
```
````

<!-- target: src/content/docs/docs/tooling/cli/migrations/undo.mdx (new page) -->

````mdx
---
title: "migrations undo"
description:
  "Reverts a content migration run that migrations apply recorded, block by block, keeping edits
  made since the run."
---

Reverts a content migration run that [`migrations apply`](/docs/tooling/cli/migrations/apply)
recorded. The command restores each block the run changed in the stories as they are now, so edits
made since the run are kept.

## Usage

```bash
storyblok migrations undo [flags]
```

## Flags

| Flag                       | Type    | Description                                                                                                                                            |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--space`, `-s`            | integer | _Required._ The ID of the Storyblok space to undo the run in.                                                                                          |
| `--run`                    | string  | _Optional._ The ID of the run to undo, as [`migrations list`](/docs/tooling/cli/migrations/list) prints it. Defaults to the latest run not undone yet. |
| `--force`                  | boolean | _Optional._ Overwrite blocks with fields changed since the run. The command lists them before it writes.                                               |
| `--allow-pending-releases` | boolean | _Optional._ Undo the run while releases are pending. The command lists the releases it doesn’t restore.                                                |
| `--path`, `-p`             | string  | _Optional._ Base path for migration files and run records. Defaults to `.storyblok`.                                                                   |

## Conflicts

A block conflicts when a field the run changed was changed again since, by an editor or by a
migration run that isn’t in the local journal. The command leaves a conflicting block as it is,
reports its fields, and restores the other blocks. Pass `--force` to overwrite conflicting blocks.
The command also reports blocks that are no longer in the story and stories that were deleted.

## Undone runs

The command marks a run as undone once it restored every story, so the next `migrations undo` moves
on to the run before it. While blocks are left in place, the run stays open, so
`migrations undo --force` still reaches them, and `migrations list` shows it as partly undone. When
a story can’t be read or written, the command exits with an error and the run stays open. Run the
undo again to retry.

The space checks content against its current schema, not the schema of the run. When a later push
made a field required, the space can refuse the restored content. Push the schema as it was before
the run, then undo again. When the space saves the draft but refuses to publish it, the command
restores the draft, names the story, and exits with an error. Publish the story once the space
accepts its content.

## Undo order

The command refuses to undo a run while a later run that isn’t undone changed any of the same
blocks, and lists those runs, since the later run can depend on what the earlier one wrote. Undo the
listed runs first, newest first.

## Pending releases

As with [`migrations apply`](/docs/tooling/cli/migrations/apply#pending-releases), the command
refuses to run while a release is pending. Pass `--allow-pending-releases` to undo the run anyway.

## Publishing

The command republishes a story the run published only if the story is still published and has no
unpublished changes. Otherwise, it restores the draft and lists the story. A story the run published
for the first time stays published.

## Examples

The following examples assume that a `space` has been defined in a configuration file.

```bash
# Undo the latest run
storyblok migrations undo

# Undo a specific run and overwrite blocks changed since
storyblok migrations undo --run 2026-10-29T13-32-45-737Z-20261029132727-rename-teaser-to-excerpt --force
```
````

<!-- target: src/content/docs/docs/tooling/cli/index.mdx (migrations link cards: `apply` before `generate`, `list` after `generate`, `undo` after `run`) -->

```mdx
<LinkCard
  description="Apply typed content migrations and record each run. Read when reshaping content after a schema change."
  href="/docs/tooling/cli/migrations/apply"
  title="migrations apply"
/>
<LinkCard
  description="List the content migration runs recorded for a space. Read when picking a run to undo."
  href="/docs/tooling/cli/migrations/list"
  title="migrations list"
/>
<LinkCard
  description="Revert a recorded content migration run block by block. Read when a migration produced the wrong result."
  href="/docs/tooling/cli/migrations/undo"
  title="migrations undo"
/>
```

<!-- target: src/content/docs/docs/libraries/js/schema/index.mdx#programmatic-use (end of section) -->

```mdx
<Aside type="tip">
  The Storyblok CLI wraps these steps in [`migrations apply`](/docs/tooling/cli/migrations/apply)
  and [`migrations undo`](/docs/tooling/cli/migrations/undo).
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
