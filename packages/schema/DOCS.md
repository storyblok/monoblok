# Staged docs: `@storyblok/schema/migrations`

Staged docs-site content for content migrations. Each section starts with a `target` marker naming
the docs platform heading it belongs to. Everything goes on the existing `@storyblok/schema` page,
`src/content/docs/docs/libraries/js/schema/index.mdx`. Add `Badge` to its
`@astrojs/starlight/components` import.

<!-- target: src/content/docs/docs/libraries/js/schema/index.mdx#content-migrations (new h2 after "API", before "Further resources") -->

## Content migrations

_Introduced in_ <Badge text="0.6.0" variant="success" />

A **content migration** is an ordered list of operations (ops) that reshapes story content after a
block schema changes, for example to rename a field, convert a value, or restructure nested blocks.
`defineMigration()` and the ops are exported from the `@storyblok/schema/migrations` subpath. The
ops are typed against the schema, and every run is recorded, so it can be undone.

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

The filename without its extension is the migration ID. It holds a numeric prefix, which sets the
run order, followed by lowercase letters, digits, and hyphens. The `title` is optional and
descriptive only. Pass the ops directly when a migration needs no title:
`defineMigration<Schema>([...ops])`.

`Schema` is the project’s current schema type, as described in [`Schema`](#schema). `Before` is the
same type for the schema as it stood before the migration, saved next to the migration file:

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

### Schema types

The type arguments of `defineMigration()` decide which names the ops accept:

| Call                              | Names an op reads (`block`, `field`)       | Names an op writes (`to`, `into`) |
| --------------------------------- | ------------------------------------------ | --------------------------------- |
| `defineMigration<Schema>`         | Names from `Schema`, plus any other string | Names from `Schema`               |
| `defineMigration<Schema, Before>` | Names from `Before` only                   | Names from `Schema`               |

With a single schema type, a field the migration renames away no longer exists in that type, so
reads accept any string. Autocomplete still lists the names the schema has, but a typo in a name the
op reads compiles. The following migration compiles even though `Schema` has no `subtitle` field:

```ts
import { defineMigration, removeField } from "@storyblok/schema/migrations";
import type { Schema } from "../../../schema";

export default defineMigration<Schema>([removeField({ block: "article", field: "subtitle" })]);
```

Callbacks receive values and block content typed from `Before`, and `alterBlock()` returns content
typed from `Schema`.

Ops infer the schema types from the `defineMigration()` call they’re passed to. An op created
outside that call, for example in a variable, has nothing to infer them from and fails to compile.
Pass the schema types and the block name explicitly, or annotate the op list:

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

### Ops

`block` names the block the op applies to. Key ops apply to every instance of the block, and value
ops accept `under` (see [Key ops and value ops](#key-ops-and-value-ops)):

| Op                                                    | Kind  | Effect                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `renameField({ block, field, to })`                   | Key   | Renames a field. Refuses a story whose `to` field already holds a value. `undefined`, `null`, `""`, and `[]` count as empty.                                                                                              |
| `moveField({ block, field, to })`                     | Key   | Renames a field and overwrites any value the `to` field holds.                                                                                                                                                            |
| `removeField({ block, field })`                       | Key   | Deletes a field.                                                                                                                                                                                                          |
| `addField({ block, field }, fn)`                      | Key   | Sets `field` to `fn(block)` on blocks that don’t have the key. Returning `undefined` leaves the block unchanged. A rerun keeps values editors set since.                                                                  |
| `coerceField({ block, field, to, from? })`            | Key   | Converts a value to `"string"`, `"number"`, or `"boolean"`. Refuses a story with a value that has no faithful counterpart. With `from`, the op can be undone without a recorded run.                                      |
| `splitField({ block, field, into, merge? }, split)`   | Key   | Replaces `field` with the values `split(value)` returns, assigned to the `into` fields by position. Refused on translated fields. With `merge`, the op can be undone without a recorded run.                              |
| `mergeFields({ block, fields, into, split? }, merge)` | Key   | Replaces `fields` with `merge(values)` in the `into` field, with `values` in the order of `fields`. Refused on translated fields. With `split`, the op can be undone without a recorded run.                              |
| `renameBlock({ block, to })`                          | Key   | Changes the `component` of every instance. Rename the block in the schema separately.                                                                                                                                     |
| `wrapChildren({ block, field, in, into })`            | Key   | Moves all child blocks of `field` into one new `in` block, under its `into` field. The new block’s `_uid` derives from the parent, the field, and `in`, so a rerun doesn’t add a second level.                            |
| `unwrapChildren({ block, field, unwrap, from })`      | Key   | Replaces each `unwrap` block in `field` with the child blocks of its `from` field. Drops the container’s own fields. Only an undo of a recorded run restores them.                                                        |
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
- Returning a block of the type it replaces refuses the story, because a rerun would expand it
  again.

### Op order and block names

Ops run in order, over every block of a story at any depth. Every op addresses a block by the name
the block had before the migration ran:

- After `renameBlock({ block: "card", to: "teaser" })`, later ops in the same migration still
  address the block as `card`.
- An op that addresses a name an earlier op introduced, such as `teaser` in the example above,
  reaches the block only when the migration runs again, so the story is refused.
- Blocks the migration creates, such as the container of `wrapChildren()` or the blocks
  `expandBlock()` returns, carry no pre-migration name, so no op reaches them.

A migration has no `down` function. An undo replays what the run recorded, or an inverse derived
from the ops.

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

Languages come from the keys a block holds, not from the schema, so one migration works across
spaces with different languages.

```ts
defineMigration<Schema>([
  alterField({ block: "article", field: "title" }, (title, { language }) =>
    language === undefined ? title.trim() : title,
  ),
]);
```

### Refused stories

A refused story stays unchanged. A migration refuses a story when one of the following applies:

- The story already holds repeated block `_uid` values, and the migration reaches one of its blocks.
  Saving such a story assigns new `_uid` values and breaks the undo record.
- The migration leaves blocks with a repeated or missing `_uid`.
- `splitField()` or `mergeFields()` touches a translated field.
- An op refuses a block, for example a rename onto a field that holds a value.
- The migration isn’t idempotent. Every run applies the migration a second time over its own output,
  and any op that changes the story again refuses it. A callback that toggles a value and an op that
  addresses a name an earlier op introduced both fail this check.

### Undo

An undo of a recorded run keeps every block an editor changed since the run and reports it as a
conflict. Without a recorded run, the inverse is derived from the ops alone, which can’t detect
those changes. Each op inverts as follows:

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
`mergeFields()` without `split`.

### Programmatic use

`applyMigration()` applies a migration to a set of stories fetched with the Management API and
returns the content to write back:

```ts
import { applyMigration } from "@storyblok/schema/migrations";
import migration from "./.storyblok/migrations/12345/0002-rename-article-author";

const { writes, refusals } = applyMigration({
  migration,
  id: "0002-rename-article-author",
  space: "12345",
  stories,
});
```
