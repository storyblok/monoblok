# Staged docs: `migrations apply`, `list`, `undo`, `generate`, `schema push`, and `client.releases`

Staged docs-site content for the CLI’s content migration commands, the migration files
`migrations generate` and `schema push` write, and the Management API client’s `releases` resource.
Each section starts with a `target` marker naming the docs platform page and heading it belongs to.

- **New pages:** `src/content/docs/docs/tooling/cli/migrations/apply.mdx`, `list.mdx`, and
  `undo.mdx`.
- **Navigation:** in `src/config/navigation/tooling.ts`, add these entries to the `migrations`
  group, keeping its items in alphabetical order:

  ```ts
  { label: "apply", link: "docs/tooling/cli/migrations/apply" },
  { label: "list", link: "docs/tooling/cli/migrations/list" },
  { label: "undo", link: "docs/tooling/cli/migrations/undo" },
  ```

- **Existing pages:** `tooling/cli/index.mdx` gets three link cards, `migrations/generate.mdx` and
  `schema/push.mdx` document the typed migration files they write, and
  `libraries/js/management-api-client/index.mdx` gets the `releases` resource.

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
[`schema push --typed`](/docs/tooling/cli/schema/push#typed-content-migrations) writes one for the
breaking changes of a push.

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
them.

### Reruns

Every run applies every migration again. A migration that already applied changes nothing and
records nothing. So that later schema changes don’t undo it, the command first compares each op with
the blocks in the space. It skips and reports an op that writes a field the block no longer has,
removes a field the block has again, or converts a field to a type it no longer has. So apply each
migration before you push the next schema change:

- Push the schema before you apply a migration that writes new fields. `schema push --typed` does
  this, since it pushes before you apply the migration it wrote.
- The command skips an op on a field that a later push renamed or removed, even in stories that
  still hold the field.
- The command skips a `renameField` while the block still has the field it renames.

Delete a migration once every space it targets has applied it. A later rename, removal, or type
change of a field it writes is a type error in that migration.

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

The following examples assume you defined a `space` in a configuration file. A typical schema change
pushes the schema, previews the migration `schema push` wrote, and applies it:

```bash
storyblok schema push src/schema/schema.ts --typed
storyblok migrations apply 20261029141150-rename-twitter-to-x --dry-run
storyblok migrations apply 20261029141150-rename-twitter-to-x --publish published
```

Apply every pending migration:

```bash
storyblok migrations apply
```
````

<!-- target: src/content/docs/docs/tooling/cli/migrations/list.mdx (new page) -->

````mdx
---
title: "migrations list"
description:
  "Lists the content migration runs that migrations apply recorded for a Storyblok space, and the
  migrations still pending."
---

Lists the content migration runs that [`migrations apply`](/docs/tooling/cli/migrations/apply)
recorded for a Storyblok space, oldest first, followed by the migrations still pending. Each run
shows its ID, the migration title, and the stories and blocks it changed:

```text
ℹ 2026-10-29T13-32-45-737Z-20261029132727-rename-teaser-to-excerpt  Rename teaser to excerpt on blog entries and events  478 stories, 478 blocks
```

A run also shows when it was undone, partly undone, or interrupted. Each machine records its own
runs, so a migration applied elsewhere shows as pending here. The command reads local records only
and doesn’t require a login.

## Usage

```bash
storyblok migrations list [flags]
```

## Flags

| Flag            | Type    | Description                                                                          |
| --------------- | ------- | ------------------------------------------------------------------------------------ |
| `--space`, `-s` | integer | _Required._ The ID of the Storyblok space to list runs for.                          |
| `--path`, `-p`  | string  | _Optional._ Base path for migration files and run records. Defaults to `.storyblok`. |
| `--pending`     | boolean | _Optional._ List only the migrations with no run still in place, one ID per line.    |

## Examples

The following examples assume you defined a `space` in a configuration file.

```bash
# List every run and the pending migrations
storyblok migrations list

# List the migrations not yet applied from this machine
storyblok migrations list --pending
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
The command also reports blocks that are no longer in the story and deleted stories.

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

The following examples assume you defined a `space` in a configuration file.

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

<!-- target: src/content/docs/docs/tooling/cli/migrations/generate.mdx (after the paragraph about the template function) -->

````mdx
## Typed content migrations

Pass `--schema` with your schema entry file to generate a typed content migration for
[`migrations apply`](/docs/tooling/cli/migrations/apply) instead, next to a snapshot of the block as
it is in the space:

```text
.storyblok/
└── migrations/
    └── <space-id>/
        ├── <timestamp>-<slug>.ts
        └── <timestamp>-<slug>.before.ts
```

The migration default-exports an empty `defineMigration()` from
[@storyblok/schema](/docs/libraries/js/schema#content-migrations), typed against the `Schema` type
your entry file exports and the `Before` type the snapshot exports. Its timestamp sorts it after
every existing migration. The snapshot lists the block’s fields and names the blocks around it
without their fields. To change fields of a nested block, generate a migration for that block too.

Add `.storyblok/migrations` to the `include` of your `tsconfig.json`, so a type error in a migration
fails your type check. Commit both files, and keep the snapshot unchanged once the migration ships.

Generate the migration before you push the schema change, so the snapshot holds the fields the
migration reads. When `schema push` already changed the block, pass `--before-push` to snapshot it
as it was before that push. Pass `--no-before` to skip the snapshot.
````

<!-- target: src/content/docs/docs/tooling/cli/migrations/generate.mdx#flags (add the rows after `--suffix`) -->

| Flag            | Type    | Description                                                                                                                                               |
| --------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--schema`      | string  | _Optional._ Path to the schema entry file, which must export `type Schema`. Generates a typed content migration and its snapshot instead of a `.js` file. |
| `--no-before`   | boolean | _Optional._ With `--schema`, skip the snapshot.                                                                                                           |
| `--before-push` | boolean | _Optional._ With `--schema`, snapshot the block as it was before the latest `schema push` that changed it.                                                |

<!-- target: src/content/docs/docs/tooling/cli/migrations/generate.mdx#examples (append to the code block) -->

```bash
# Generate a typed content migration for the "author" block
storyblok migrations generate author --schema src/schema/schema.ts

# The same, for a block schema push already changed
storyblok migrations generate author --schema src/schema/schema.ts --before-push
```

<!-- target: src/content/docs/docs/tooling/cli/schema/push.mdx#breaking-changes-and-migrations (replace the section body) -->

````mdx
A push has breaking changes when it removes, renames, or changes the type of a field, makes a field
required, or removes values an option or options field offers. The command lists them and asks
whether to generate migrations, then confirms each detected rename. Pass `--migrations` to generate
them without asking, which takes detected field renames as given, or `--no-migrations` to skip them.
Switching a field among text, textarea, and markdown isn’t a breaking change, because all three
store a string.

By default, the command writes one `.js` migration per changed block for
[`migrations run`](/docs/tooling/cli/migrations/run). With `--dry-run`, it prints the breaking
changes and detected renames without writing migration files.

### Typed content migrations

Pass `--typed` to write one typed content migration for all changed blocks instead, for
[`migrations apply`](/docs/tooling/cli/migrations/apply), next to a `.before.ts` snapshot of those
blocks as they are before the push:

```bash
storyblok schema push src/schema/schema.ts --typed
```

This migration is what the command wrote for a renamed field, a newly required `email` field, and a
removed `large` option, with its `TODO` ops completed:

```ts title=".storyblok/migrations/12345/20261103093215-update-author-hero.ts"
import { addField, alterField, defineMigration, renameField } from "@storyblok/schema";
import type { Schema } from "../../../src/schema/schema.js";
import type { Before } from "./20261103093215-update-author-hero.before.js";

const EDITORIAL_EMAIL = "editorial@example.com";

export default defineMigration<Schema, Before>([
  renameField({ block: "author", field: "bluesky_account", to: "bluesky_handle" }),
  addField({ block: "author", field: "email" }, () => EDITORIAL_EMAIL),
  alterField({ block: "author", field: "email" }, (value, { language }) =>
    language === undefined && (value === null || value === "") ? EDITORIAL_EMAIL : undefined,
  ),
  alterField({ block: "hero", field: "headline_size" }, (value) =>
    value === "large" ? "normal" : undefined,
  ),
]);
```

The migration handles these changes:

- Renames and removes fields.
- Converts values between text, textarea, markdown, and number fields, and between those string
  fields and boolean fields.
- Fills required boolean fields with `false` where the value is missing. For a required field of
  another type, it writes an op that needs a default. For a newly required text, textarea, markdown,
  or number field, that op also fills empty strings.
- Renames a block the push renamed in place, after the ops that change its fields.
- Marks the values an option or options field no longer offers. The op throws on a removed value
  until you map it to one the field still offers. Options a datasource supplies aren’t checked.

Comments starting with `TODO` mark ops to complete, such as a conversion between other field types
or a default for a required field of another type. Such an op throws until you replace it, so
`migrations apply` refuses the stories it applies to. A `TODO` also marks a removed field that may
have been renamed to a new field rename detection didn’t pair with it. Without the rename, the
removal deletes the field’s content. Pass `--no-before` to skip the snapshot.

To switch from `.js` migrations, finish running them with `migrations run`, delete or move the `.js`
files, then push with `--typed` and use `migrations apply` from then on.

### Renamed blocks

When a block is missing locally and a new block shares most of its fields and is a content type
exactly when the old one is, the command asks whether the block was renamed, naming the number of
stories that use it. On confirmation, it renames the block in place, so it keeps its ID, and points
the folders whose default or allowed content types name the block at the new name. Otherwise it
creates the new block next to the old one.

With `--delete`, the command refuses to delete a block that stories still use. Rename the block,
migrate its stories first, or pass `--force` to delete it anyway. The command then names the folders
that still name the deleted block as a content type.

### Failed pushes

The command updates blocks independently, so a failed push can leave some of them updated. A rerun
no longer sees their changes, so when a push fails, the command reads the space again, keeps the
migration for the updated blocks only, and points folders at the blocks it renamed. The next push
generates the migration for the other blocks. If the space can’t be read, the command names the
migration files and leaves them in place.
````

<!-- target: src/content/docs/docs/tooling/cli/schema/push.mdx#flags (replace the `--migrations` row, then add the rows after it) -->

| Flag           | Type    | Description                                                                                                                                            |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--migrations` | boolean | _Optional._ Generate migration files for breaking changes without asking, taking detected field renames as given. Pass `--no-migrations` to skip them. |
| `--typed`      | boolean | _Optional._ Generate one typed content migration for `migrations apply` instead of one `.js` migration per block.                                      |
| `--no-before`  | boolean | _Optional._ With `--typed`, skip the schema snapshot.                                                                                                  |
| `--force`      | boolean | _Optional._ With `--delete`, delete blocks that stories still use.                                                                                     |
