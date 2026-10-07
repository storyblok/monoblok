# Staged docs: content migrations in `@storyblok/schema`

Staged docs-site content for content migrations. Everything goes on the existing `@storyblok/schema`
page, `src/content/docs/docs/libraries/js/schema/index.mdx`. Add `Badge` to its
`@astrojs/starlight/components` import.

<!-- target: src/content/docs/docs/libraries/js/schema/index.mdx#content-migrations (new h2 after "API", before "Further resources") -->

## Content migrations

_Introduced in_ <Badge text="0.6.0" variant="success" />

A **content migration** is an ordered list of operations (ops) that reshapes story content after a
block schema changes, for example to rename a field or convert its values. The ops are typed against
your schema. The Storyblok CLI applies migrations with
[`migrations apply`](/docs/tooling/cli/migrations/apply) and reverts a run with
[`migrations undo`](/docs/tooling/cli/migrations/undo).

### Write a migration

A migration file default-exports the result of `defineMigration()`. This migration renames the
`twitter_account` field of the `author` and `mvp` blocks:

```ts title=".storyblok/migrations/12345/20261029141150-rename-twitter-to-x.ts"
import { defineMigration, renameField } from "@storyblok/schema";
import type { Schema } from "../../../src/schema/schema.js";
import type { Before } from "./20261029141150-rename-twitter-to-x.before.js";

export default defineMigration<Schema, Before>({
  title: "Rename twitter_account to x_account on authors and MVPs",
  ops: [
    renameField({ block: "author", field: "twitter_account", to: "x_account" }),
    renameField({ block: "mvp", field: "twitter_account", to: "x_account" }),
  ],
});
```

The file name without its extension is the migration ID: a numeric prefix that sets the run order,
followed by lowercase letters, digits, and hyphens. The `title` is optional. Without one, pass the
ops directly: `defineMigration<Schema, Before>([...ops])`.

`Schema` is the type your schema entry file exports, as described in [`Schema`](#schema). `Before`
is the same type for the schema as it was before the migration, exported by a snapshot next to the
migration:

```ts title=".storyblok/migrations/12345/20261029141150-rename-twitter-to-x.before.ts"
import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { Schema } from "@storyblok/schema";

const authorBlock = defineBlock({
  name: "author",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("given_name", { type: "text", required: true }),
    defineField("twitter_account", { type: "text" }),
    // ...
  ],
});

// ...

export const schema = defineSchema({ blocks: { authorBlock, mvpBlock } });

export type Before = Schema<typeof schema>;
```

Keep the snapshot unchanged once the migration ships, so the names the migration reads stay typed.
The names it writes are typed against `Schema`, so a later rename or removal of such a field is a
type error in the migration. Once every space has applied the migration, delete it and its snapshot.

The Storyblok CLI writes both files:
[`migrations generate --schema`](/docs/tooling/cli/migrations-generate#typed-content-migrations) and
[`schema push`](/docs/tooling/cli/schema-push#breaking-changes-and-migrations) generate the
migration and its snapshot from the space’s current components.

### Schema types

The type arguments of `defineMigration()` decide which names the ops accept:

| Call                              | Names an op reads (`block`, `field`)       | Names an op writes (`to`, `into`) |
| --------------------------------- | ------------------------------------------ | --------------------------------- |
| `defineMigration<Schema>`         | Names from `Schema`, plus any other string | Names from `Schema`               |
| `defineMigration<Schema, Before>` | Names from `Before` only                   | Names from `Schema`               |

Without `Before`, a field the migration renames away no longer exists in any type, so reads accept
any string, and a typo in a name an op reads compiles. Callbacks receive values typed from `Before`,
and `alterBlock()` returns content typed from `Schema`.

Ops infer their types from the `defineMigration()` call they’re passed to. An op created outside
that call, for example in a variable, fails to compile. Pass the types and the block name, or
annotate the list:

```ts
import { defineMigration, renameField, type MigrationOps } from "@storyblok/schema";
import type { Schema } from "../../../src/schema/schema.js";
import type { Before } from "./20261029141150-rename-twitter-to-x.before.js";

const renameAuthorAccount = renameField<Schema, Before, "author">({
  block: "author",
  field: "twitter_account",
  to: "x_account",
});

const ops: MigrationOps<Schema, Before> = [renameAuthorAccount];

export default defineMigration<Schema, Before>(ops);
```

### Ops

`block` names the block the op applies to. Key ops apply to every instance of the block. Value ops
accept `under` (see [Key ops and value ops](#key-ops-and-value-ops)):

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
| `alterField({ block, field, under? }, fn)`            | Value | Sets the field to `fn(value, context)`, once for the base key and once per translation key. Returning `undefined` leaves the key unchanged; use `removeField()` to remove a field.                                        |
| `alterBlock({ block, under? }, fn)`                   | Value | Passes a copy of the block to `fn`. Return the whole block, including `_uid` and `component` (spread the block into the result), or change the copy and return nothing. Refuses a story when the result lacks either key. |
| `expandBlock({ block, under? }, fn)`                  | Value | Replaces the block in its `bloks` field with the blocks `fn(block)` returns.                                                                                                                                              |
| `reorderField({ block, field, under? }, compare)`     | Value | Sorts the child blocks of a `bloks` field with `compare(a, b, { siblings, index })`. `siblings` is the list before sorting, and `index(child)` returns a block’s original position.                                       |

A callback that throws refuses the story, and the refusal names the op and the block. Throw for a
value the callback can’t convert, so an editor can fix that story by hand:

```ts
splitField(
  {
    block: "metric",
    field: "value",
    into: ["prefix", "amount", "suffix"],
    merge: (values) => values.filter(Boolean).join(" "),
  },
  (value) => {
    // "£2M+" → "£", "2", "M+"
    const match = /^(\D*?)\s*(\d[\d,]*(?:\.\d+)?)\s*(.*)$/.exec(value?.trim() ?? "");
    if (!match) throw new Error(`metric value "${value}" holds no amount`);
    const [, prefix, amount, suffix] = match;
    return [prefix, amount.replaceAll(",", ""), suffix];
  },
);
```

`coerceField()` converts values as follows:

| `to`        | Accepted values                                                        | Written value                                                                                      |
| ----------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `"string"`  | Strings, numbers, and booleans                                         | The value as a string                                                                              |
| `"number"`  | Finite numbers, decimal strings such as `"12.50"`, and `""`            | The number as a normalized string, such as `"12.5"`, because Storyblok number fields store strings |
| `"boolean"` | `true`, `"true"`, `"1"`, `1`, `false`, `"false"`, `"0"`, `0`, and `""` | `true` or `false`                                                                                  |

`null` and `undefined` stay unchanged. Any other value, including objects and arrays, refuses the
story.

`expandBlock()` differs from the other ops:

- It runs after all other ops, so `fn` receives the block as the other ops left it.
- It only replaces blocks inside a `bloks` field. A story’s root block stays in place.
- Every returned block needs a `_uid`. Derive it from the replaced block’s `_uid`, such as
  `` `${block._uid}-image` ``, so a rerun produces the same blocks.
- Returning a block of the type it replaces refuses the story, because a rerun would expand it
  again.

### Op order and block names

Ops run in order, over every block of a story at any depth. Every op addresses a block by the name
it had before the migration:

- After `renameBlock({ block: "changelog_entry_v2", to: "changelog_entry" })`, later ops in the same
  migration still address the block as `changelog_entry_v2`.
- An op that addresses a name an earlier op introduced reaches the block only on a rerun, so the
  migration refuses the story.
- Blocks the migration creates, such as the container of `wrapChildren()`, have no pre-migration
  name, so no op reaches them.

A migration has no `down` function. An undo replays what the run recorded, or an inverse derived
from the ops.

### Key ops and value ops

Ops fall into two kinds:

- **Key ops** change which keys a block holds, which is part of its block schema. A block schema
  applies to every instance, so key ops do too and reject `under`.
- **Value ops** change values and keep the keys. `alterField()`, `alterBlock()`, `expandBlock()`,
  and `reorderField()` accept `under` to limit the op to some instances.

`under` takes one block name, matched anywhere above the block, or an array of names, outermost
first. Gaps are allowed, so `under: ["page", "card"]` also matches a block inside a card in a grid
in the page. This op changes only the heroes inside an `enterprise_page`:

```ts
alterField({ block: "hero", field: "headline_size", under: "enterprise_page" }, (size) =>
  size === " " ? "normal" : undefined,
);
```

### Translations

With [field-level translation](/docs/concepts/internationalization#field-level-translation),
Storyblok stores each translated value next to the base key as `<field>__i18n__<language>`, with `-`
in the language code written as `_` (for example, `title__i18n__en_US`). The ops treat a field as
the base key plus all its translation keys:

- `renameField()`, `moveField()`, `removeField()`, and `coerceField()` change all keys together. A
  rename or move first deletes the target’s translation keys, so old translations don’t attach to
  the new value.
- `alterField()` calls its callback once per key. `context.language` is `undefined` for the base key
  and the language code, such as `en-US`, for a translation key. `context.key` is the key being
  written.
- `splitField()` and `mergeFields()` refuse a story whose source or target field holds translation
  keys. Use `alterBlock()` instead.
- `alterBlock()` receives the raw keys, translation keys included.
- `addField()` sets the base key only.

Languages come from the keys a block holds, not from the schema, so one migration works across
spaces with different languages.

### Refused stories

A refused story stays unchanged. A migration refuses a story when:

- The story already holds repeated block `_uid` values, and the migration reaches one of its blocks.
  Saving such a story assigns new `_uid` values and breaks the undo record.
- The migration leaves blocks with a repeated or missing `_uid`.
- `splitField()` or `mergeFields()` touches a translated field.
- An op refuses a block, for example a rename onto a field that holds a value, or a callback throws.
- A second pass of the migration over its own output changes the story again, as a callback that
  toggles a value does.

### Undo

An undo of a recorded run keeps every block changed since the run and reports it as a conflict.
Without a recorded run, the inverse derives from the ops alone and can’t detect those changes:

| Op                                                        | Inverse                                                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `renameField()`, `renameBlock()`, `wrapChildren()`        | The mirror op. Exact.                                                                    |
| `moveField()`                                             | `moveField()` back. Lossy: the overwritten value is gone.                                |
| `coerceField()` with `from`                               | `coerceField()` back to `from`. Lossy.                                                   |
| `addField()`                                              | `removeField()`. Lossy: it also removes values that existed before the run.              |
| `splitField()` with `merge`, `mergeFields()` with `split` | The counterpart op. Lossy.                                                               |
| `unwrapChildren()`                                        | `wrapChildren()`. Lossy: it rebuilds one container and drops the containers’ own fields. |

The other ops have no inverse, and neither do `coerceField()` without `from`, `splitField()` without
`merge`, and `mergeFields()` without `split`.

### Programmatic use

`applyMigration()` applies a migration to stories fetched with the Management API and returns the
content to write back. It doesn’t receive the schema, so first check the migration with
`validateMigration()` against the schema as it was before the migration:

```ts
import { applyMigration, validateMigration } from "@storyblok/schema";
import migration from "./.storyblok/migrations/12345/20261029141150-rename-twitter-to-x.js";
import { schema } from "./.storyblok/migrations/12345/20261029141150-rename-twitter-to-x.before.js";

const errors = validateMigration(migration, schema).filter((issue) => issue.severity === "error");
if (errors.length > 0) {
  throw new Error(errors.map((issue) => `op ${issue.op}: ${issue.message}`).join("\n"));
}

const { writes, refusals } = applyMigration({
  migration,
  id: "20261029141150-rename-twitter-to-x",
  space: "12345",
  stories,
});
```

Pass `{ nameOnlyBlocks }` as the third argument of `validateMigration()` to name blocks that exist
but whose fields the schema doesn’t describe. An op that reads their fields is an error. A check
that needs their fields, such as wrapping blocks into one of them, returns a warning.
