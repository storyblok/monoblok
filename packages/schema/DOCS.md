# Staged docs: `@storyblok/schema/migrations`

Staged docs-site content for the content migrations engine. Each section starts with a `target`
marker naming the docs platform page and heading it belongs to.

- **New page:** `src/content/docs/docs/libraries/js/schema/migrations.mdx`
- **Navigation:** in `src/config/navigation/libraries.ts`, add this entry to the `JavaScript` group,
  directly after `{ label: "Schema", link: "docs/libraries/js/schema" }`:

  ```ts
  { label: "Content Migrations", link: "docs/libraries/js/schema/migrations" },
  ```

- **Existing page:** `src/content/docs/docs/libraries/js/schema/index.mdx` gets a short pointer
  section and a link card. Add `Badge` to its `@astrojs/starlight/components` import.

<!-- target: src/content/docs/docs/libraries/js/schema/migrations.mdx (new page: frontmatter and introduction) -->

```mdx
---
title: "@storyblok/schema/migrations"
description:
  "@storyblok/schema/migrations applies typed content migrations to the stories in a space and
  records each run for undo."
---

import { Aside, LinkCard } from "@astrojs/starlight/components";
```

`@storyblok/schema/migrations` is the content migrations engine of
[@storyblok/schema](/docs/libraries/js/schema). A **content migration** is an ordered list of
operations (ops) that reshapes story content after a block schema changes, for example to rename a
field, convert a value, or restructure nested blocks. The ops are typed against the schema, and
every run records what it changed, so an undo can revert it.

The engine makes no Management API calls. Each function returns what to write, and the calling code
fetches the stories, writes them, and stores the record. Only migration file discovery and the
default journal use the file system, and they load it on first call, so the module imports in any
JavaScript runtime.

<!-- target: src/content/docs/docs/libraries/js/schema/migrations.mdx#installation -->

## Installation

The subpath ships with `@storyblok/schema`. Add the package to a project by running this command in
the terminal:

```bash
npm install @storyblok/schema
```

<!-- target: src/content/docs/docs/libraries/js/schema/migrations.mdx#usage -->

## Usage

A migration run follows these steps:

1. Write a migration file that default-exports a `defineMigration()` result.
2. Check that the space has no pending releases with `checkPendingReleases()`.
3. Fetch the stories that contain the migration’s target blocks and pass them to `applyMigration()`.
4. Write each returned story with the Management API, then record the run in a journal.
5. To revert the run, plan the undo with `planUndo()`, fetch the stories again, and write what
   `undoStories()` returns.

The examples in this section use the following directory layout, with one directory of migration
files per space:

```text
.storyblok/migrations/
├── .journal/                                 # created by resolveJournal(), git-ignored
└── 12345/                                    # the space ID
    ├── 0001-rename-card-title.ts
    ├── 0002-rename-article-author.ts
    └── 0002-rename-article-author.before.ts  # schema snapshot, ignored by the loader
```

### Write a migration

A migration file default-exports the result of `defineMigration()`. This migration renames the
`author` field of the `article` block to `byline` and converts its `price` field from text to a
number:

```ts title=".storyblok/migrations/12345/0002-rename-article-author.ts"
import { coerceField, defineMigration, renameField } from "@storyblok/schema/migrations";
import type { Schema } from "../../../schema";
import type { Before } from "./0002-rename-article-author.before";

export default defineMigration<Schema, Before>({
  title: "Rename article.author to byline",
  ops: [
    renameField({ block: "article", field: "author", to: "byline" }),
    coerceField({ block: "article", field: "price", from: "string", to: "number" }),
  ],
});
```

`Schema` is the project’s current schema type, as described in
[@storyblok/schema](/docs/libraries/js/schema#schema). `Before` is the same type for the schema as
it stood before the migration, saved next to the migration file:

```ts title=".storyblok/migrations/12345/0002-rename-article-author.before.ts"
import {
  defineBlock,
  defineField,
  defineSchema,
  type Schema as InferSchema,
} from "@storyblok/schema";

const articleBlock = defineBlock({
  name: "article",
  is_root: true,
  fields: [
    defineField("title", { type: "text", required: true }),
    defineField("author", { type: "text" }),
    defineField("price", { type: "text" }),
  ],
});

export const schema = defineSchema({ blocks: { articleBlock } });

export type Before = InferSchema<typeof schema>;
```

Keep the snapshot unchanged once the migration ships. Later schema changes then can’t break the
migration’s types.

### Apply migrations

The following script applies every migration in a space’s directory that the journal hasn’t recorded
yet. The `./storyblok` module stands for the project’s own Management API calls:

```ts title="storyblok.ts"
import type { ReleaseForMigration, StoryForMigration } from "@storyblok/schema/migrations";

// Implement these with the Management API. `fetchStories()` returns each story with its `content`.
export declare function fetchReleases(space: string): Promise<ReleaseForMigration[]>;
export declare function fetchStories(
  space: string,
  filter: { blocks: string[] } | { ids: number[] },
): Promise<StoryForMigration[]>;
export declare function updateStory(
  space: string,
  id: number,
  content: unknown,
  publish: boolean,
): Promise<void>;
```

```ts title="migrate.ts"
import path from "node:path";
import { createJiti } from "jiti";
import {
  applyMigration,
  checkPendingReleases,
  loadMigrations,
  resolveJournal,
} from "@storyblok/schema/migrations";
import { fetchReleases, fetchStories, updateStory } from "./storyblok";

const SPACE = "12345";
const migrationsDirectory = path.resolve(".storyblok/migrations");
const journal = resolveJournal(migrationsDirectory);
const jiti = createJiti(import.meta.url);

const releases = checkPendingReleases(await fetchReleases(SPACE));
if (!releases.proceed) {
  throw new Error(
    `Deploy or delete these releases first: ${releases.pending.map((release) => release.name).join(", ")}`,
  );
}

const applied = new Set((await journal.list(SPACE)).map((run) => run.migration));
const migrations = await loadMigrations(path.join(migrationsDirectory, SPACE), (file) =>
  jiti.import(file, { default: true }),
);

for (const { id, migration } of migrations) {
  if (applied.has(id)) continue;

  const stories = await fetchStories(SPACE, { blocks: migration.targets });
  const outcome = applyMigration({ migration, id, space: SPACE, stories, publish: "published" });

  for (const refusal of outcome.refusals) {
    console.warn(`Skipped ${refusal.slug}: ${refusal.reason}`);
  }
  for (const write of outcome.writes) {
    await updateStory(SPACE, write.story.id, write.content, write.publish);
  }
  await journal.record(outcome.run, outcome.inverse);
  console.log(`Recorded run ${outcome.run.id}`);
}
```

Record the run only after every write succeeded. `applyMigration()` writes nothing itself, so a dry
run is the same script without the `updateStory()` and `journal.record()` calls.

### Undo a run

The following script undoes the latest recorded run in the space:

```ts title="undo.ts"
import path from "node:path";
import { planUndo, resolveJournal, undoStories } from "@storyblok/schema/migrations";
import { fetchStories, updateStory } from "./storyblok";

const SPACE = "12345";
const journal = resolveJournal(path.resolve(".storyblok/migrations"));

const latest = (await journal.list(SPACE)).at(-1);
if (!latest) throw new Error("Nothing to undo.");

const plan = await planUndo({ journal, space: SPACE, id: latest.id });
const stories = await fetchStories(SPACE, { ids: plan.stories });
const outcome = undoStories({ inverse: plan.inverse, stories });

for (const { slug, count } of outcome.conflicts) {
  console.warn(`${slug}: kept ${count} block(s) an editor changed since the run`);
}
for (const write of outcome.writes) {
  await updateStory(SPACE, write.story.id, write.content, write.publish);
}
```

<Aside type="caution">
  Undo needs the run ID (`latest.id`), not the migration ID. The journal keeps a run’s entry after an undo, so the latest entry stays the same and a second undo of it changes nothing.
</Aside>

<!-- target: src/content/docs/docs/libraries/js/schema/migrations.mdx#how-migrations-run -->

## How migrations run

The rules in this section apply to every op and explain most refusals that `applyMigration()`
reports.

### Op order and block names

`applyMigration()` runs the ops in order, over every block of a story at any depth. Every op
addresses a block by the name the block had before the migration ran:

- After `renameBlock({ block: "card", to: "teaser" })`, later ops in the same migration still
  address the block as `card`.
- An op that addresses a name an earlier op introduced, such as `teaser` in the example above,
  reaches the block only when the migration runs again. `applyMigration()` refuses that story as
  non-idempotent.
- Blocks the migration creates, such as the container of `wrapChildren()` or the blocks
  `expandBlock()` returns, carry no pre-migration name, so no op reaches them.

A migration has no `down` function. Undo replays what the run recorded, or an inverse derived from
the ops with `deriveInverse()`.

### Schema types

The type arguments of `defineMigration()` decide which names the ops accept:

| Call                              | Names an op reads (`block`, `field`)       | Names an op writes (`to`, `into`) |
| --------------------------------- | ------------------------------------------ | --------------------------------- |
| `defineMigration<Schema>`         | Names from `Schema`, plus any other string | Names from `Schema`               |
| `defineMigration<Schema, Before>` | Names from `Before` only                   | Names from `Schema`               |

With a single schema type, a field the migration renames away no longer exists in that type, so
reads accept any string. Autocomplete still lists the names the schema has, but a typo in a name the
op reads compiles. `validateMigration()` catches it at run time. The following migration compiles
even though `Schema` has no `subtitle` field:

```ts
import { defineMigration, removeField } from "@storyblok/schema/migrations";
import type { Schema } from "../../../schema";

export default defineMigration<Schema>([removeField({ block: "article", field: "subtitle" })]);
```

Callbacks receive values and block content typed from `Before`, and `alterBlock()` returns content
typed from `Schema`.

Op factories infer the schema types from the `defineMigration()` call they’re passed to. An op
created outside that call, for example in a variable, has nothing to infer them from and fails to
compile. Pass the schema types and the block name explicitly, or annotate the op list:

```ts
import { defineMigration, renameField, type MigrationOps } from "@storyblok/schema/migrations";
import type { Schema } from "../../../schema";
import type { Before } from "./0002-rename-article-author.before";

const renameAuthor = renameField<Schema, Before, "article">({
  block: "article",
  field: "author",
  to: "byline",
});

const ops: MigrationOps<Schema, Before> = [renameAuthor];

export default defineMigration<Schema, Before>(ops);
```

### Key ops and value ops

Ops fall into two kinds:

- **Key ops** change which keys a block holds, which is part of the block schema. A block schema
  applies to every instance of the block, so key ops apply to every instance and reject `under`.
- **Value ops** change values and keep the keys. `alterField()`, `alterBlock()`, `expandBlock()`,
  and `reorderField()` are value ops and accept `under` to limit the op to some instances.

`under` takes one block name, matched anywhere above the block, or an array of names, outermost
first, in which each name has to appear above the next. Gaps are allowed, so
`under: ["page", "card"]` also matches a block inside a card that sits in a grid inside the page. A
migration keeps working when an editor nests content one level deeper.

```ts
defineMigration<Schema>([
  alterField({ block: "meta", field: "og_title", under: ["section", "card"] }, (title) =>
    title?.trim(),
  ),
]);
```

### Translations

With [field-level translation](/docs/concepts/internationalization#field-level-translation),
Storyblok stores each translated value next to the base key as `<field>__i18n__<language>`, with `-`
in the language code written as `_` (for example, `title__i18n__en_US`). The ops treat a field as
the base key plus all its translation keys:

- `renameField()`, `moveField()`, `removeField()`, and `coerceField()` rename, delete, or convert
  all keys together. A rename or move first deletes the target’s translation keys, so old
  translations don’t attach to the new value.
- `alterField()` calls its callback once per key. `context.language` is `undefined` for the base key
  (the default language) and the language code, such as `en-US`, for a translation key.
  `context.key` is the key being written.
- `splitField()` and `mergeFields()` refuse a story when a source or target field holds translation
  keys, because a split of the default-language value doesn’t define how to split its translations.
  Use `alterBlock()` instead.
- `alterBlock()` receives the raw keys, translation keys included.
- `addField()` sets the base key only.

The engine reads the languages from the keys a block holds, not from the schema, so one migration
works across spaces with different languages.

```ts
defineMigration<Schema>([
  alterField({ block: "article", field: "title" }, (title, { language }) =>
    language === undefined ? title.trim() : title,
  ),
]);
```

<!-- target: src/content/docs/docs/libraries/js/schema/migrations.mdx#api -->

## API

The following sections document each function and type that `@storyblok/schema/migrations` exports.

### `defineMigration()`

```ts
defineMigration<After>(ops);
defineMigration<After, Before>(ops);
defineMigration<After, Before>({ title, ops });
```

Returns a compiled migration: an object with the optional `title`, the `ops` array, and `targets`,
the block names the ops address. Pass `targets` to the story fetch to read only the stories that
contain one of these blocks. The `title` is descriptive only. A migration’s identity comes from its
filename.

### Ops

Each op factory returns a plain object, so ops compose like any other value. `block` names the block
the op applies to. All key ops apply to every instance of the block, and the value ops accept
`under`:

| Op                                                    | Kind  | Effect                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `renameField({ block, field, to })`                   | Key   | Renames a field. Refuses a story whose `to` field already holds a value. `undefined`, `null`, `""`, and `[]` count as empty.                                                                                              |
| `moveField({ block, field, to })`                     | Key   | Renames a field and overwrites any value the `to` field holds.                                                                                                                                                            |
| `removeField({ block, field })`                       | Key   | Deletes a field.                                                                                                                                                                                                          |
| `addField({ block, field }, fn)`                      | Key   | Sets `field` to `fn(block)` on blocks that don’t have the key. Returning `undefined` leaves the block unchanged. A rerun keeps values editors set since.                                                                  |
| `coerceField({ block, field, to, from? })`            | Key   | Converts a value to `"string"`, `"number"`, or `"boolean"`. Refuses a story with a value that has no faithful counterpart. `from` is optional and lets `deriveInverse()` convert back.                                    |
| `splitField({ block, field, into, merge? }, split)`   | Key   | Replaces `field` with the values `split(value)` returns, assigned to the `into` fields by position. Refused on translated fields. `merge` is the optional counterpart that lets `deriveInverse()` invert the op.          |
| `mergeFields({ block, fields, into, split? }, merge)` | Key   | Replaces `fields` with `merge(values)` in the `into` field, with `values` in the order of `fields`. Refused on translated fields. `split` is the optional counterpart.                                                    |
| `renameBlock({ block, to })`                          | Key   | Changes the `component` of every instance. Rename the block in the schema separately.                                                                                                                                     |
| `wrapChildren({ block, field, in, into })`            | Key   | Moves all child blocks of `field` into one new `in` block, under its `into` field. The new block’s `_uid` derives from the parent, the field, and `in`, so a rerun doesn’t add a second level.                            |
| `unwrapChildren({ block, field, unwrap, from })`      | Key   | Replaces each `unwrap` block in `field` with the child blocks of its `from` field. Drops the container’s own fields. The recorded undo restores them, a derived inverse can’t.                                            |
| `alterField({ block, field, under? }, fn)`            | Value | Sets the field to `fn(value, context)`, once for the base key and once per translation key.                                                                                                                               |
| `alterBlock({ block, under? }, fn)`                   | Value | Passes a copy of the block to `fn`. Return the whole block, including `_uid` and `component` (spread the block into the result), or change the copy and return nothing. Refuses a story when the result lacks either key. |
| `expandBlock({ block, under? }, fn)`                  | Value | Replaces the block in its `bloks` field with the blocks `fn(block)` returns.                                                                                                                                              |
| `reorderField({ block, field, under? }, compare)`     | Value | Sorts the child blocks of a `bloks` field with `compare(a, b, { siblings, index })`. `siblings` is the list before sorting, and `index(child)` returns a block’s original position.                                       |

A callback that throws refuses the story, and the refusal names the op and the block.

`coerceField()` converts values as follows:

| `to`        | Accepted values                                                        | Written value                                                                                      |
| ----------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `"string"`  | Strings, numbers, and booleans                                         | The value as a string                                                                              |
| `"number"`  | Finite numbers, decimal strings such as `"12.50"`, and `""`            | The number as a normalized string, such as `"12.5"`, because Storyblok number fields store strings |
| `"boolean"` | `true`, `"true"`, `"1"`, `1`, `false`, `"false"`, `"0"`, `0`, and `""` | `true` or `false`                                                                                  |

`null` and `undefined` stay unchanged. Any other value, including objects and arrays, refuses the
story.

`expandBlock()` differs from the other ops in these ways:

- It runs after all other ops, so `fn` receives the block as the other ops left it.
- It only replaces blocks inside a `bloks` field. A story’s root block stays in place.
- Every returned block needs a `_uid`. Derive it from the replaced block’s `_uid` (for example,
  `` `${block._uid}-image` ``), so running the migration again produces the same blocks.
- Returning a block of the type it replaces refuses the story as non-idempotent, because a rerun
  would expand it again.

### `checkPendingReleases()`

```ts
checkPendingReleases(releases);
checkPendingReleases(releases, { allowPendingReleases: true });
```

Checks the space’s [releases](/docs/api/management/releases/retrieve-multiple-releases) before a
run. The story endpoints don’t return content scheduled in a release, so a migration can’t reach it,
and deploying the release later replaces the story’s draft and discards the migration. Each release
needs an `id`, a `name`, and a `released` flag.

Returns `{ proceed, pending }`. `proceed` is `false` while any release has `released: false`, unless
`allowPendingReleases` is `true`. `pending` lists the releases the run can’t reach.

### `applyMigration()`

```ts
applyMigration({ migration, id, space, stories });
applyMigration({ migration, id, space, stories, publish });
```

Applies a migration to a set of stories and returns what to write. It writes nothing and leaves the
stories it receives unchanged. `applyMigration()` accepts the following properties:

| Name        | Description                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migration` | A `defineMigration()` result.                                                                                                                                                               |
| `id`        | The migration ID, such as `0002-rename-article-author`. `loadMigrations()` derives it from the filename. The journal stores it with each run, so a repeated run is visible.                 |
| `space`     | The space ID, as a string.                                                                                                                                                                  |
| `stories`   | Stories with `id`, `slug`, and `content`, plus `published` and `unpublished_changes` as the Management API returns them. A story without the publish fields counts as an unpublished draft. |
| `publish`   | Which written stories to publish. Omit it to write drafts only.                                                                                                                             |
| `appliedAt` | Optional. The `Date` to record for the run. Defaults to the current time.                                                                                                                   |

The `publish` property accepts the following modes:

| Mode                       | Published stories                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Omitted                    | None. Every write is a draft.                                                                        |
| `"all"`                    | Every written story, including stories that were never published.                                    |
| `"published"`              | Published stories without unpublished changes, so publishing ships only the migration.               |
| `"published-with-changes"` | Published stories with unpublished changes, so publishing also ships the pending changes of editors. |

`applyMigration()` returns an object with the following properties:

| Name                 | Description                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `writes`             | One `{ story, content, publish }` entry per changed story. Save `content` as the story’s content, and publish it when `publish` is `true`. Unchanged stories have no entry. |
| `refusals`           | One `{ slug, reason }` entry per refused story. A refused story has no write.                                                                                               |
| `run`                | The journal entry for the run. Its `id` combines the time and the migration ID.                                                                                             |
| `inverse`            | The inverse patches and publish state of each written story. Pass it to `journal.record()` with `run`.                                                                      |
| `publishedDraftOnly` | The number of written stories that are published but not published by this run. Their live version keeps the old shape until someone publishes them.                        |

`applyMigration()` refuses a story when one of the following applies:

- The story already holds repeated block `_uid` values, and the migration reaches one of its blocks.
  Saving such a story assigns new `_uid` values and breaks the undo record.
- The migration leaves blocks with a repeated or missing `_uid`.
- `splitField()` or `mergeFields()` touches a translated field.
- An op refuses a block, for example a rename onto a field that holds a value.
- The migration isn’t idempotent. `applyMigration()` runs the migration a second time over its own
  output, and any op that changes the story again refuses it. A callback that toggles a value and an
  op that addresses a name an earlier op introduced both fail this check.

### `planUndo()`

```ts
planUndo({ journal, space, id });
```

Reads a recorded run from `journal` and returns `{ run, inverse, stories }`, where `stories` lists
the IDs of the stories to fetch. `id` is the run ID from `journal.list()` or `outcome.run.id`, not
the migration ID. Throws a `MigrationError` when the journal holds no run with that ID, or when the
run was recorded for a different space.

### `undoStories()`

```ts
undoStories({ inverse, stories });
undoStories({ inverse, stories, force: true });
```

Replays a run’s inverse patches against the stories as they are now. Pass the stories `planUndo()`
named, including `published` and `unpublished_changes`. Without those fields, no story is
republished. A block an editor changed since the run counts as a conflict and keeps the editor’s
change, unless `force` is `true`. Even with `force`, undo never restores a block whose `_uid` the
story now holds in another place, so the story never ends up with a repeated `_uid`.

`undoStories()` returns an object with the following properties:

| Name                  | Description                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `writes`              | One `{ story, content, publish }` entry per story the undo changed. A story with a conflict still gets its other blocks restored.                                                   |
| `conflicts`           | One `{ slug, count }` entry per story with blocks an editor changed since the run, counted per block.                                                                               |
| `missing`             | One `{ slug, count }` entry per story that no longer holds blocks the run recorded.                                                                                                 |
| `unread`              | IDs of recorded stories missing from `stories`.                                                                                                                                     |
| `notRepublished`      | Slugs of stories the run published that the undo leaves as drafts: their draft changed since, they were unpublished since, or their publish state was missing.                      |
| `firstPublishedByRun` | Slugs of stories the run published for the first time. Undo restores their draft, but their published version keeps the migrated content. Unpublish them if they shouldn’t be live. |

Undo republishes a story only when the run published it and the story is still published without
unpublished changes. Undoing the same run a second time returns no writes and no conflicts.

### `deriveInverse()`

```ts
deriveInverse(ops);
```

Computes an inverse from the ops alone, without a recorded run. Use it to undo a migration on a
machine that never ran it, for example when the journal lives on another machine. A derived inverse
can’t detect changes editors made since the run, so prefer the recorded undo when the journal holds
the run.

`deriveInverse()` returns an object with the following properties:

| Name        | Description                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `derivable` | `true` when every op has an inverse.                                                                                     |
| `ops`       | The inverse ops, in reverse order, addressed to the block names the forward migration left.                              |
| `blocked`   | One `{ index, kind, reason }` entry per op without an inverse.                                                           |
| `lossy`     | Indexes of forward ops whose inverse can’t restore the original value.                                                   |
| `targets`   | The block names `ops` addresses. Differs from the forward migration’s `targets` wherever `renameBlock()` changed a name. |

Each op inverts as follows:

| Op                                                        | Inverse                                                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `renameField()`, `renameBlock()`, `wrapChildren()`        | The mirror op. Exact.                                                                    |
| `moveField()`                                             | `moveField()` back. Lossy: the overwritten value is gone.                                |
| `coerceField()` with `from`                               | `coerceField()` back to `from`. Lossy.                                                   |
| `addField()`                                              | `removeField()`. Lossy: it also removes values that existed before the run.              |
| `splitField()` with `merge`, `mergeFields()` with `split` | The counterpart op. Lossy.                                                               |
| `unwrapChildren()`                                        | `wrapChildren()`. Lossy: it rebuilds one container and drops the containers’ own fields. |

`removeField()`, `reorderField()`, `alterField()`, `alterBlock()`, and `expandBlock()` have no
inverse, and neither do `coerceField()` without `from`, `splitField()` without `merge`, and
`mergeFields()` without `split`. `deriveInverse()` lists them in `blocked`.

To apply a derived inverse, pass it to `applyMigration()` like any migration:

```ts
import { applyMigration, deriveInverse } from "@storyblok/schema/migrations";
import migration from "./.storyblok/migrations/12345/0002-rename-article-author";
import { fetchStories } from "./storyblok";

const derived = deriveInverse(migration.ops);
if (!derived.derivable) {
  throw new Error(
    derived.blocked.map((op) => `Op ${op.index} (${op.kind}): ${op.reason}`).join("\n"),
  );
}
if (derived.lossy.length > 0) {
  throw new Error(`Ops ${derived.lossy.join(", ")} can't be inverted without losing data.`);
}

const outcome = applyMigration({
  migration: { ops: derived.ops, targets: derived.targets },
  id: "0002-rename-article-author-inverse",
  space: "12345",
  stories: await fetchStories("12345", { blocks: derived.targets }),
});
```

### `validateMigration()`

```ts
validateMigration(migration, schema);
```

Checks a migration against `schema`, the schema the content has before the migration runs, such as
the `defineSchema()` result in a `Before` snapshot. Returns an array of `{ op, message }` issues,
empty when the migration is valid. It catches the names the single-schema form accepts and checks
migration files written in plain JavaScript.

`validateMigration()` reports the following issues:

- An unknown block, or a field the block doesn’t have when the op runs. A field an earlier op added
  or renamed counts.
- A `renameField()` onto a field the schema defines, or a `renameBlock()` onto a block the schema
  defines.
- An `unwrapChildren()` container block or `from` field the schema doesn’t define.
- `under` on a key op, or an unknown block name in `under`.

```ts
import { validateMigration } from "@storyblok/schema/migrations";
import migration from "./.storyblok/migrations/12345/0002-rename-article-author";
import { schema } from "./.storyblok/migrations/12345/0002-rename-article-author.before";

for (const issue of validateMigration(migration, schema)) {
  console.error(`Op ${issue.op}: ${issue.message}`);
}
```

### Migration files

```ts
discoverMigrations(directory);
selectMigrationFiles(directory, filenames);
loadMigrations(directory, importDefault);
```

A migration file is named `<number>-<name>.ts`, `.js`, or `.mjs`, where `<name>` holds lowercase
letters, digits, and hyphens. The filename without its extension is the migration ID. Migrations run
in the numeric order of their prefix, so `9-…` runs before `10-…`, and date prefixes such as
`20261007-…` work too. The loader ignores files that don’t match the pattern, including
`*.before.ts` snapshots. Two files with the same ID, such as `0001-x.ts` and `0001-x.js`, throw a
`MigrationError`.

- `discoverMigrations()` returns the `{ id, file }` entries of a directory in run order. A missing
  directory returns an empty array.
- `selectMigrationFiles()` does the same for a list of filenames, without touching the file system,
  for runtimes that list files in another way.
- `loadMigrations()` returns `{ id, file, migration }` entries. `importDefault` loads a file and
  returns its default export. The package ships no TypeScript loader, so pass one such as
  [jiti](https://github.com/unjs/jiti) or [tsx](https://tsx.is). Throws a `MigrationError` when a
  file’s default export isn’t a migration.

### Journal

```ts
resolveJournal(migrationsDirectory);
localJournal(journalDirectory);
```

A journal stores each run in two parts: a small entry that listings read, and the inverse patches
that undo replays.

- `resolveJournal()` returns the local journal in the `.journal` directory (exported as
  `JOURNAL_DIRECTORY`) inside `migrationsDirectory`.
- `localJournal()` stores one directory per space with two JSON files per run: `<run-id>.json` and
  `<run-id>.patches.json`. In a directory named `.journal`, it also writes a `.gitignore` that
  ignores the whole directory, because recorded runs describe one machine’s view of a space. Space
  and run IDs may contain only letters, digits, `_`, and `-`.

The journal has no locking: two runs against the same space at the same time each record their own
entry. To store runs elsewhere, implement the `Journal` interface:

```ts
interface Journal {
  record(run: MigrationRun, inverse: StoryInverse[]): Promise<void>;
  list(space: string): Promise<MigrationRun[]>;
  read(id: string): Promise<MigrationRun | undefined>;
  readInverse(id: string): Promise<StoryInverse[]>;
}
```

- `record()` stores both parts. Write the inverse patches before the entry, so an entry never points
  at patches that don’t exist.
- `list()` returns the entries of a space without their patches. The local journal returns them
  oldest first.
- `read()` returns `undefined` for an unknown run ID.
- `readInverse()` returns a run’s inverse patches.

A `MigrationRun` entry has an `id`, the `space`, the `migration` ID, the optional `title`,
`appliedAt` as an ISO 8601 string, and the number of `stories` and `blocks` the run changed.
`runId(migration, date)` builds the run IDs `applyMigration()` uses, which sort in chronological
order.

### `MigrationError`

`planUndo()`, the migration file functions, and the local journal throw a `MigrationError` for
problems the caller has to fix, such as an unknown run ID or an invalid migration file.
`applyMigration()` and `validateMigration()` return refusals and issues instead of throwing.

The package also exports the types of every input and result on this page, including
`CompiledMigration`, `MigrationOps`, `MigrationOp`, `StoryForMigration`, `PublishMode`,
`MigrationWrite`, `ApplyMigrationOutcome`, `UndoPlan`, `UndoOutcome`, `DerivedInverse`,
`MigrationIssue`, `Journal`, `MigrationRun`, and `StoryInverse`.

<!-- target: src/content/docs/docs/libraries/js/schema/migrations.mdx#further-resources -->

## Further resources

<LinkCard
  description="Author blocks, fields, and schemas as typed TypeScript objects."
  href="/docs/libraries/js/schema"
  title="@storyblok/schema"
/>

<LinkCard
  description="Update a story’s content and publish it with the Management API."
  href="/docs/api/management/stories/update-a-story"
  title="Update a story"
/>

<!-- target: src/content/docs/docs/libraries/js/schema/index.mdx#content-migrations (new h3 under "API", after "Validators") -->

### Content migrations

_Introduced in_ <Badge text="0.6.0" variant="success" />

The `@storyblok/schema/migrations` subpath exports a typed content migrations engine. Its ops
rename, convert, and restructure fields and blocks across the stories of a space, typed against the
schema, and each run records what it changed, so an undo can revert it.

```ts
import { defineMigration, renameField } from "@storyblok/schema/migrations";
import type { Schema } from "./schema";

export default defineMigration<Schema>([
  renameField({ block: "article", field: "author", to: "byline" }),
]);
```

Learn how to write, apply, and undo migrations in the
[content migrations reference](/docs/libraries/js/schema/migrations).

<!-- target: src/content/docs/docs/libraries/js/schema/index.mdx#further-resources (add before the existing LinkCard) -->

<LinkCard
  description="Write typed content migrations, apply them to a space, and undo a run."
  href="/docs/libraries/js/schema/migrations"
  title="Content migrations"
/>
