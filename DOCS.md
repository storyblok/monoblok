# Staged docs: `migrations apply`, `list`, `undo`, `generate`, `schema push`, and `client.releases`

Staged docs-site content for the CLI's content migration commands, the migration files
`migrations generate` and `schema push` write, and the Management API client's `releases` resource.
Each section starts with a `target` marker naming the docs platform page and heading it belongs to.

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
  `src/content/docs/docs/libraries/js/schema/migrations.mdx` gets a pointer to the CLI,
  `src/content/docs/docs/libraries/js/management-api-client/index.mdx` gets the `releases` resource,
  and `migrations-generate.mdx` and `schema-push.mdx` document the typed migration files they write.

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
file whose default export is the result of `defineMigration()` from
[@storyblok/schema/migrations](/docs/libraries/js/schema/migrations).

## Prerequisites

- Content migration files in `.storyblok/migrations/<space-id>/`, named `<number>-<name>.ts`,
  `<number>-<name>.js`, or `<number>-<name>.mjs`, where `<name>` holds lowercase letters, digits,
  and hyphens, for example `0001-rename-article-author.ts`. The command ignores files with other
  names.

## Usage

```bash
storyblok migrations apply [arguments] [flags]
```

## Arguments

| Argument       | Type   | Description                                                                                                                                 |
| -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration name | string | _Optional._ The file name of a single migration, with or without its extension. If omitted, every migration in the directory runs in order. |

## Flags

| Flag                       | Type    | Description                                                                                                                                                                                            |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--space`, `-s`            | integer | _Required._ The ID of the Storyblok space to apply migrations to.                                                                                                                                      |
| `--dry-run`, `-d`          | boolean | _Optional._ Report the stories and blocks each migration changes without writing them.                                                                                                                 |
| `--schema`                 | string  | _Optional._ Path to a schema entry file that describes the schema as it stood before the migration. Checks the migration against it instead of its `.before.ts` snapshot. Requires a single migration. |
| `--no-validate`            | boolean | _Optional._ Skip checking each migration against its `.before.ts` snapshot.                                                                                                                            |
| `--publish`                | string  | _Optional._ Publish the migrated stories. See [Publishing](#publishing). Defaults to drafts only.                                                                                                      |
| `--allow-pending-releases` | boolean | _Optional._ Apply the migrations while releases are pending. The command lists the releases it doesn’t migrate.                                                                                        |
| `--path`, `-p`             | string  | _Optional._ Base path for migration files and run records. Defaults to `.storyblok`.                                                                                                                   |

## How a run works

The command runs the migrations in the order of their numeric prefix, so `2-...` runs before
`10-...`. Each migration only fetches the stories that contain a block it targets. Files named
`*.before.ts` are schema snapshots and never run. With a migration name, the command loads only that
file.

The command skips and reports a story when the migration would lose data, when a migration callback
throws, when the story already contains repeated block IDs, or when a second pass of the migration
would change the story again. It still writes the other stories. The command exits with an error
when a migration skipped every story it matched, or when a story couldn’t be read or written.

The command records each run in `.storyblok/migrations/.journal/` before writing the first story, so
a run that stops partway can still be undone. After the writes, it narrows the record to the stories
that changed, and removes it when none did. A run that stopped partway keeps the stories it planned
to change, and [`migrations list`](/docs/tooling/cli/migrations-list) shows it as interrupted. The
journal writes its own `.gitignore`, so run records stay local. A rerun of a migration that already
applied changes nothing and records nothing.

Every run applies every migration in the directory again, so the command first compares each op with
the space’s current blocks. It skips and reports an op that writes a field the block no longer has,
or that removes a field the block has again. Without this, a migration that added a field a later
migration renamed would add it back on every run. Push the schema before you apply a migration that
writes new fields, or the command skips those ops. Ops on blocks the space doesn’t hold aren’t
checked.

Delete a migration once every space it targets has applied it, or exclude it from type checking. A
later rename or removal of a field it writes is a type error in that migration.

[`migrations run`](/docs/tooling/cli/migrations-run) loads every `.js` file in the same directory,
so a space that uses both commands reports each `.js` content migration as an error that points to
`migrations apply`. Use `.ts` or `.mjs` for content migrations in that case: `migrations run` skips
them and names them with the same pointer.

## Schema check

Before it fetches any story, the command checks each migration against the `.before.ts` snapshot
next to it: the schema as it was before the migration. The command stops when a migration names a
block or field that the snapshot doesn’t define, renames a field or block onto one that already
exists, or wraps blocks in an existing block that lacks the target field. It reports the mismatches
of every migration before it stops. A migration without a snapshot runs unchecked, and the command
lists it in a warning. Pass `--schema` to check a single migration against another schema entry
file, or `--no-validate` to skip the check. The two flags can’t be combined.

A snapshot can also export `nameOnlyBlocks`, the blocks that exist in the space but whose fields it
doesn’t list. The check counts them as existing blocks. It stops when an op reads one of their
fields, and only warns when blocks are wrapped in or unwrapped from one of them.

## Pending releases

The command changes only the current version of each story, not the content in releases. Deploying a
release later overwrites the migrated story. The command refuses to run while a release in the space
is pending and lists the releases. Deploy or delete them first, or pass `--allow-pending-releases`.
A dry run lists pending releases without refusing.

The check sees only the releases your account can access, and not releases that belong to a pipeline
branch. If the command can’t list the releases, it stops, unless you pass `--allow-pending-releases`
or `--dry-run`.

## Publishing

By default, the command writes drafts. A published story then keeps its old content in the published
version until someone publishes it, and the command reports how many published stories this affects.
Pass `--publish` to publish migrated stories along with the write. The modes don’t overlap:

- `all`: every migrated story, including stories that were never published.
- `published`: published stories without unpublished changes.
- `published-with-changes`: published stories with unpublished changes. Publishing them also
  publishes those changes.

No mode publishes every published story and nothing else. Use `all`, or publish the stories with
unpublished changes yourself.

## Examples

The following examples assume that a `space` has been defined in a configuration file.

```bash
# Preview every migration
storyblok migrations apply --dry-run

# Apply a single migration and check it against a schema entry file instead of its snapshot
storyblok migrations apply 0001-rename-article-author --schema src/schema-before.ts

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
recorded for a Storyblok space, oldest first. Each line shows the run ID, the migration title (or
file name), the number of stories and blocks the run changed, and when the run was undone, or partly
undone when an undo restored some blocks and left others in place. A run that stopped before it
finished shows as interrupted. The command reads local records only, so it doesn’t require a login.

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

| Flag                       | Type    | Description                                                                                                                                                    |
| -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--space`, `-s`            | integer | _Required._ The ID of the Storyblok space to undo the run in.                                                                                                  |
| `--run`                    | string  | _Optional._ The ID of the run to undo, as [`migrations list`](/docs/tooling/cli/migrations-list) prints it. Defaults to the most recent run that isn’t undone. |
| `--force`                  | boolean | _Optional._ Overwrite blocks with fields changed since the run. The command lists them before it writes.                                                       |
| `--allow-pending-releases` | boolean | _Optional._ Undo the run while releases are pending. The command lists the releases it doesn’t restore.                                                        |
| `--path`, `-p`             | string  | _Optional._ Base path for migration files and run records. Defaults to `.storyblok`.                                                                           |

## Conflicts

A block conflicts when a field the run changed was changed again since: by an editor, or by a
migration whose run isn’t in the local journal, such as one applied from another machine. Later runs
in the journal are covered by [Undo order](#undo-order). The command leaves a conflicting block as
it is, reports its fields, and restores the other blocks. It keeps edits to fields the run didn’t
change without a conflict. Pass `--force` to overwrite conflicting blocks.

The command also reports blocks that are no longer in the story and stories that were deleted.

## Undone runs

The command marks a run as undone once it restored every story, so the next `migrations undo` moves
on to the run before it. A run stays open while blocks are left in place, so
`migrations undo --force` still reaches them. When the undo restored some blocks and left others in
place, `migrations list` shows the run as partly undone. When a story can’t be read or written, the
command exits with an error and the run stays open. Run the undo again to retry.

## Undo order

The command refuses to undo a run while a later run that isn’t undone changed any of the same
blocks, and lists those runs. A later run can depend on content the earlier run wrote, even where it
left that content as it was, so undoing the earlier run first could remove content the later run
needs. Undo the listed runs first, newest first. Runs that changed other blocks can be undone in any
order.

## Pending releases

As with [`migrations apply`](/docs/tooling/cli/migrations-apply#pending-releases), the command
refuses to run while a release is pending. Pass `--allow-pending-releases` to undo the run anyway.
Deploying a release later overwrites the restored story.

## Publishing

The command republishes a story the run published only if the story is still published and has no
unpublished changes. Otherwise, it restores the draft and lists the story. A story the run published
for the first time stays published. Unpublish it if it shouldn’t be live.

## Examples

The following examples assume that a `space` has been defined in a configuration file.

```bash
# Undo the most recent run
storyblok migrations undo

# Undo a specific run and overwrite blocks changed since
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

<!-- target: src/content/docs/docs/tooling/cli/migrations-generate.mdx (after the paragraph about the template function) -->

````mdx
## Typed content migrations

Pass `--schema` with your project’s schema entry file to generate a typed content migration for
[`migrations apply`](/docs/tooling/cli/migrations-apply) instead. The command names the file after
the time it was created, so it runs after every existing content migration, and writes a schema
snapshot next to it:

```text
.storyblok/
└── migrations/
    └── <space-id>/
        ├── <timestamp>-<slug>.ts
        └── <timestamp>-<slug>.before.ts
```

The slug is the component name and suffix in lowercase letters, digits, and hyphens.

The migration file default-exports an empty `defineMigration()` call from
[@storyblok/schema/migrations](/docs/libraries/js/schema/migrations), typed against the `Schema`
type your schema entry file exports and the `Before` type the snapshot exports. The snapshot holds
the block’s fields as they are in the space now, so the migration can name fields your schema no
longer has. The snapshot lists the other blocks the migration can name, such as the blocks a field
allows, by name only. To change fields of a nested block, generate a migration for that block too.

The migrations directory sits outside most `tsconfig.json` `include` patterns. Add
`.storyblok/migrations` to `include`, or run `tsc` on it in CI, so a type error in a migration fails
the build.

Commit both files, and keep the snapshot unchanged once the migration ships. The command refuses to
overwrite an existing migration or snapshot.

Pass `--no-before` to skip the snapshot.
````

<!-- target: src/content/docs/docs/tooling/cli/migrations-generate.mdx#flags (add the rows after `--suffix`) -->

| Flag          | Type    | Description                                                                                                                                                           |
| ------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--schema`    | string  | _Optional._ Path to the schema entry file, which must export `type Schema`. Generates a typed content migration and its schema snapshot instead of a `.js` migration. |
| `--no-before` | boolean | _Optional._ With `--schema`, skip the schema snapshot.                                                                                                                |

<!-- target: src/content/docs/docs/tooling/cli/migrations-generate.mdx#examples (append to the code block) -->

```bash
# Generate a typed content migration for the "hero-section" component
storyblok migrations generate hero-section --schema src/schema.ts
```

<!-- target: src/content/docs/docs/tooling/cli/schema-push.mdx#breaking-changes-and-migrations (replace the section body) -->

```mdx
When a push contains breaking changes (field removals, type changes, renames, or new required
fields), the command analyzes them and, unless `--no-migrations` is set, writes one `.js` migration
per changed block for [`migrations run`](/docs/tooling/cli/migrations-run). The command confirms
detected renames interactively. Switching a field among text, textarea, and markdown isn’t a
breaking change, because all three store a string.

### Typed content migrations

Pass `--typed` to write one typed content migration for all changed blocks instead, for
[`migrations apply`](/docs/tooling/cli/migrations-apply). The migration in
`.storyblok/migrations/<space-id>/` is named after the time it was created, next to a `.before.ts`
snapshot of the changed blocks as they are in the space before the push. The migration handles these
changes:

- Renames and removes fields.
- Converts values between text, textarea, markdown, and number fields, and between those string
  fields and boolean fields.
- Fills new or newly required boolean fields with `false` where the field is absent or `null`.

Comments starting with `TODO` mark the ops to complete, such as a conversion between other field
types or a default value for a required field of another type. Such an op throws until you replace
it, so `migrations apply` refuses to change the stories it applies to. A newly required text,
textarea, markdown, or number field also counts an empty string as missing. A `TODO` also marks a
removed field that may have been renamed to a new field of the same type that rename detection
didn’t pair with it. Without the rename, the removal deletes the field’s content.

`migrations apply` writes a story only when every op in the migration succeeds on it. If an op fails
on one block, the story stays unchanged, including its other blocks.

Pass `--no-before` with `--typed` to skip the snapshot.

To move from `.js` migrations to typed content migrations, finish running the `.js` migrations with
`migrations run`, then push with `--typed` and use `migrations apply` from then on. `migrations run`
exits with an error when the directory holds only content migrations, so a script that still runs it
after `schema push --typed` fails instead of skipping the migration.

### Failed pushes

The command writes the migration before it pushes. When the push fails, it reads the space again to
find out which blocks were updated. It keeps the migration for those blocks only and removes the
rest, because the next push generates the migration for the other blocks again. If the space can’t
be read, the command names the migration files and leaves them in place.

With `--dry-run`, the command prints the number of breaking changes and the detected renames, but
doesn’t write migration files.
```

<!-- target: src/content/docs/docs/tooling/cli/schema-push.mdx#flags (add the rows after `--migrations`) -->

| Flag          | Type    | Description                                                                                                       |
| ------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `--typed`     | boolean | _Optional._ Generate one typed content migration for `migrations apply` instead of one `.js` migration per block. |
| `--no-before` | boolean | _Optional._ With `--typed`, skip the schema snapshot next to the content migration.                               |
