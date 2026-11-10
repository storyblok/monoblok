# Staged docs: `migrations run`, `rollback`, `list`, and `client.releases`

Staged docs-site content for the CLI’s migration commands and the Management API client’s `releases`
resource. Each section starts with a `target` marker naming the docs platform page and heading it
belongs to.

- **Replaced pages:** `src/content/docs/docs/tooling/cli/migrations/run.mdx` and `rollback.mdx`.
- **New page:** `src/content/docs/docs/tooling/cli/migrations/list.mdx`.
- **Navigation:** in `src/config/navigation/tooling.ts`, add this entry to the `migrations` group,
  keeping its items in alphabetical order:

  ```ts
  { label: "list", link: "docs/tooling/cli/migrations/list" },
  ```

- **Existing pages:** `tooling/cli/index.mdx` gets a link card, `libraries/js/schema/index.mdx` gets
  a pointer to the CLI, and `libraries/js/management-api-client/index.mdx` gets the `releases`
  resource.

<!-- target: src/content/docs/docs/tooling/cli/migrations/run.mdx (replaces the page) -->

````mdx
---
title: "migrations run"
description:
  "Runs the migration functions and typed content migrations in a Storyblok space’s migrations
  directory, and records each run so migrations rollback can revert it."
---

Runs the migrations in a Storyblok space’s migrations directory and records each run, so
[`migrations rollback`](/docs/tooling/cli/migrations/rollback) can revert it. The command runs two
kinds of migrations:

- **Migration functions:** `.js` files that default-export a function, which the command calls for
  each block of one component. [`migrations generate`](/docs/tooling/cli/migrations/generate)
  creates them.
- **Content migrations:** files that default-export `defineMigration()` from
  [@storyblok/schema](/docs/libraries/js/schema#content-migrations). A content migration describes
  its changes as typed ops across any number of blocks.

## Prerequisites

- Migration files in `.storyblok/migrations/<space-id>/`:
  - Migration functions are named `<component>.js` or `<component>.<suffix>.js`.
  - Content migrations are named `<number>-<name>.ts`, `.js`, or `.mjs`, where `<name>` holds
    lowercase letters, digits, and hyphens, for example `20261029141150-rename-twitter-to-x.ts`.

The command tells a `.js` content migration from a migration function by its default export.

## Usage

```bash
storyblok migrations run [arguments] [flags]
```

## Arguments

| Argument | Type   | Description                                                                                                                                                                                          |
| -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name     | string | _Optional._ The technical name of a component, to run its migration functions, or the file name of a content migration, with or without its extension. If omitted, the command runs every migration. |

## Flags

| Flag                       | Type    | Description                                                                                                                                                                                  |
| -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--space`, `-s`            | integer | _Required._ The ID of the Storyblok space to run migrations in.                                                                                                                              |
| `--filter`, `-fi`          | string  | _Optional._ Glob pattern for the migrations to run, matched against migration function file names and content migration names. For example, `hero*` matches `hero.js` and `hero-section.js`. |
| `--dry-run`, `-d`          | boolean | _Optional._ Report the changes without writing them.                                                                                                                                         |
| `--query`, `-q`            | string  | _Optional._ Filter stories using [query parameters](/docs/api/management/stories/retrieve-multiple-stories#query-parameters).                                                                |
| `--starts-with`, `-sw`     | string  | _Optional._ A path prefix to filter stories to migrate.                                                                                                                                      |
| `--publish`                | string  | _Optional._ Publish the migrated stories. See [Publishing](#publishing). Defaults to drafts only.                                                                                            |
| `--schema`                 | string  | _Optional._ Path to a schema entry file describing the schema before a content migration. Checks the content migration against it instead of its snapshot. Requires a migration name.        |
| `--no-validate`            | boolean | _Optional._ Skip checking each content migration against its `.before.ts` snapshot.                                                                                                          |
| `--allow-pending-releases` | boolean | _Optional._ Run the migrations while releases are pending. The command lists the releases it doesn’t migrate.                                                                                |
| `--from`, `-f`             | integer | _Optional._ The ID of the space to read migration files from. Defaults to `--space`.                                                                                                         |
| `--path`, `-p`             | string  | _Optional._ Base path for migration files and run records. Defaults to `.storyblok`.                                                                                                         |

## How a run works

The command runs migration functions first, then content migrations in the order of their numeric
prefix, so `2-...` runs before `10-...`. Files named `*.before.ts` are schema snapshots and never
run. The command fetches only the stories that contain a block a migration targets.

A migration function writes each story it changes. Before the write, the command saves the story to
a rollback file in `.storyblok/migrations/<space-id>/rollbacks/`.

A content migration writes a story only when every op succeeds on it. The command skips and reports
a story when an op would lose data or its callback throws, when the story already holds repeated
block IDs, or when a second pass would change the story again:

```text
✔ 20261029142718-split-metric-value: 32 stories contain metric
⚠️  a/storyblok-vs-sitecore: op 0 (splitField) on block 6a7a6e9a-… was refused: the callback threw: metric value "CX " holds no amount
```

The command exits with an error when a content migration skipped every story that contains its
blocks, or when a story couldn’t be read or written. When a write gets no response, the command
reads the story back, and writes it again up to twice if the write didn’t land.

Before the first write, the command records each content migration run in
`.storyblok/migrations/<space-id>/rollbacks/`, so a run that stops partway can still be rolled back.
It then narrows the record to the stories that changed.
[`migrations list`](/docs/tooling/cli/migrations/list) shows a run that stopped partway as
interrupted. The directory’s `.gitignore` keeps run records on the machine that ran them. A rerun of
a content migration that already applied changes nothing and records nothing.

## Schema check

Before it fetches any story, the command checks each content migration against its `.before.ts`
snapshot, the schema as it was before the migration. It stops when a content migration names a block
or field the snapshot doesn’t define, renames a field or block onto one that exists, or wraps blocks
in an existing block that lacks the target field, and it reports the mismatches of every content
migration. A content migration without a snapshot runs unchecked with a warning. Pass `--schema` to
check a single content migration against another schema entry file, or `--no-validate` to skip the
check.

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

By default, the command writes drafts. For content migrations, it reports how many published stories
keep their old content in the published version. Pass `--publish` with one of these modes to publish
along with the write:

- `all`: every migrated story, including stories that were never published.
- `published`: published stories without unpublished changes.
- `published-with-changes`: published stories with unpublished changes, which also publishes those
  changes.

When the space saves the draft of a content migration but refuses to publish it, for example because
the content misses a field the schema now requires, the command keeps and records the draft, names
the story, and exits with an error.

## Examples

The following examples assume you defined a `space` in a configuration file.

```bash
# Run the migration functions of the "hero-section" component
storyblok migrations run hero-section

# Preview a content migration
storyblok migrations run 20261029141150-rename-twitter-to-x --dry-run

# Run every migration and publish the stories that had no unpublished changes
storyblok migrations run --publish published

# Run every migration on the highlighted stories only
storyblok migrations run --query "[highlighted][in]=true"
```
````

<!-- target: src/content/docs/docs/tooling/cli/migrations/rollback.mdx (replaces the page) -->

````mdx
---
title: "migrations rollback"
description:
  "Reverts a run of migrations run: a content migration run block by block, keeping edits made
  since, or the stories a rollback file saved."
---

Reverts a run of [`migrations run`](/docs/tooling/cli/migrations/run). The command takes one of two
kinds of run:

- **Content migration runs:** the command restores each block the run changed in the stories as they
  are now, so edits made since the run are kept.
- **Rollback files:** the stories a run of migration functions saved before writing. The command
  overwrites each story with its saved content.

## Usage

```bash
storyblok migrations rollback [arguments] [flags]
```

## Arguments

| Argument | Type   | Description                                                                                                                                                                                                                                         |
| -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run      | string | _Optional._ The ID of a content migration run or the name of a rollback file, with or without its extension, as [`migrations list`](/docs/tooling/cli/migrations/list) prints it. Defaults to the latest content migration run not rolled back yet. |

## Flags

| Flag                       | Type    | Description                                                                                                              |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `--space`, `-s`            | integer | _Required._ The ID of the Storyblok space to roll back the run in.                                                       |
| `--force`                  | boolean | _Optional._ Overwrite blocks with fields changed since a content migration run. The command lists them before it writes. |
| `--allow-pending-releases` | boolean | _Optional._ Roll back the run while releases are pending. The command lists the releases it doesn’t restore.             |
| `--path`, `-p`             | string  | _Optional._ Base path for migration files and run records. Defaults to `.storyblok`.                                     |

## Conflicts

A block conflicts when a field a content migration run changed was changed again since, by an editor
or by a migration run that isn’t recorded locally. The command leaves a conflicting block as it is,
reports its fields, and restores the other blocks. Pass `--force` to overwrite conflicting blocks.
The command also reports blocks that are no longer in the story and deleted stories.

A rollback file holds whole stories, so the command overwrites every story it names, including edits
made since the run. A rollback file isn’t marked as rolled back, so this applies every time you run
the command with it. When a story can’t be restored, the command restores the others and exits with
an error. Running it again restores every story in the file again, not only the failed ones.

## Rolled back runs

The command marks a content migration run as rolled back once it restored every story, so the next
`migrations rollback` moves on to the run before it. While blocks are left in place, the run stays
open, so `migrations rollback --force` still reaches them, `migrations list` shows it as partly
rolled back, and the command exits with an error. When a story can’t be read or written, the command
exits with an error and the run stays open. Run the rollback again to retry.

The space checks content against its current schema, not the schema of the run. When a later push
made a field required, the space can refuse the restored content. Push the schema as it was before
the run, then roll back again.

When the space saves a restored draft but refuses to publish it, the published version keeps the
migrated content. The command names the story, keeps the run open, and exits with an error. Push the
schema as it was before the run, then roll back again. The command then publishes the restored draft
if the story is still published and its draft hasn’t changed since the rollback.

## Rollback order

The command refuses to roll back a content migration run while a later run that isn’t rolled back
changed any of the same blocks, and lists those runs, since the later run can depend on what the
earlier one wrote. Roll back the listed runs first, newest first.

## Pending releases

As with [`migrations run`](/docs/tooling/cli/migrations/run#pending-releases), the command refuses
to run while a release is pending. Pass `--allow-pending-releases` to roll back the run anyway.

## Publishing

The command republishes a story a content migration run published only if the story is still
published and has no unpublished changes. Otherwise, it restores the draft and lists the story. A
story the run published for the first time stays published.

For a rollback file, the command publishes a story that was published without unpublished changes
before the run.

## Examples

The following examples assume you defined a `space` in a configuration file.

```bash
# Roll back the latest content migration run
storyblok migrations rollback

# Roll back a specific run and overwrite blocks changed since
storyblok migrations rollback 2026-10-29T13-32-45-737Z-20261029132727-rename-teaser-to-excerpt --force

# Restore the stories a rollback file saved
storyblok migrations rollback hero-section.1770129788914
```
````

<!-- target: src/content/docs/docs/tooling/cli/migrations/list.mdx (new page) -->

````mdx
---
title: "migrations list"
description:
  "Lists the content migration runs and rollback files that migrations run recorded for a Storyblok
  space."
---

Lists the runs that [`migrations rollback`](/docs/tooling/cli/migrations/rollback) can revert,
oldest first: the content migration runs and the rollback files that
[`migrations run`](/docs/tooling/cli/migrations/run) recorded for a Storyblok space. A content
migration run shows its ID, the migration title, and the stories and blocks it changed. A rollback
file shows its name and the stories it saved:

```text
ℹ hero-section.1770129788914  migration functions  12 stories  (rollback file)
ℹ 2026-10-29T13-32-45-737Z-20261029132727-rename-teaser-to-excerpt  Rename teaser to excerpt on blog entries and events  478 stories, 478 blocks
```

A content migration run also shows when it was rolled back, partly rolled back, or interrupted. The
command reads local records only and doesn’t require a login.

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

The following examples assume you defined a `space` in a configuration file.

```bash
storyblok migrations list
```
````

<!-- target: src/content/docs/docs/tooling/cli/index.mdx (migrations link cards: `list` after `generate`) -->

```mdx
<LinkCard
  description="List the migration runs recorded for a space. Read when picking a run to roll back."
  href="/docs/tooling/cli/migrations/list"
  title="migrations list"
/>
```

<!-- target: src/content/docs/docs/libraries/js/schema/index.mdx#programmatic-use (end of section) -->

```mdx
<Aside type="tip">
  The Storyblok CLI wraps these steps in [`migrations run`](/docs/tooling/cli/migrations/run) and
  [`migrations rollback`](/docs/tooling/cli/migrations/rollback).
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
