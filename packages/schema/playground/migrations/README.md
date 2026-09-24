# Content migrations playground

This playground is a deliberately awkward space — nested containers, richtext with embedded blocks,
field translations, datasource options, tables — plus twenty migrations that each break it a
different way. It runs against committed JSON, so **no Storyblok account or token is needed** for
everything up to "Against a real space".

## Setup

```sh
pnpm install
pnpm nx build @storyblok/schema
cd packages/schema/playground/migrations
```

## Example: `author.name` → `first_name` + `last_name`

The content today, in `fixtures/legacy.json`:

```json
{
  "component": "author",
  "name": "Ada Lovelace",
  "bio": "One name field, from before it was split in two."
}
```

The migration, [`migrations/0003-split-author-name.ts`](migrations/0003-split-author-name.ts):

```ts
export default defineMigration<Schema, AuthorWithName>({
  title: "Split author.name into first_name and last_name",
  ops: [
    splitField(
      { block: "author", field: "name", into: ["first_name", "last_name"], merge: joinName },
      splitName,
    ),
  ],
});
```

Run it:

```sh
pnpm migrate:offline --migration 0003-split-author-name
```

```
0003-split-author-name: migrated legacy
0003-split-author-name: recorded run 2026-09-24T09-01-51-841Z-0003-split-author-name (1 stories)
```

`git diff fixtures/`:

```json
{
  "component": "author",
  "bio": "One name field, from before it was split in two.",
  "first_name": "Ada",
  "last_name": "Lovelace"
}
```

Undo it:

```sh
pnpm migrate:offline --undo 2026-09-24T09-01-51-841Z-0003-split-author-name
```

```
undo 2026-09-24T09-01-51-841Z-0003-split-author-name: restored legacy (3 changes)
```

## Example: a typo is a compile error

`field: "name"` → `field: "naem"`:

```
error TS2322: Type '"naem"' is not assignable to type '"name" | "bio" | "avatar"'.
```

Block names, field names, and the `Before` snapshot the content is migrating _from_ are all typed.

## Example: a migration that gets refused

[`0017`](migrations/0017-unwrap-page-sections.ts) dissolves the sections a page holds directly —
which lifts the nested sections into the same field, where a second run would dissolve those too.

```sh
pnpm migrate:offline --migration 0017-unwrap-page-sections
```

```
0017-unwrap-page-sections: refused home (migration) — op 0 disagrees with itself on a second pass
0017-unwrap-page-sections: migrated legacy
```

The engine applies each migration twice and refuses to write any story the second pass moves again.

## The other seventeen

```sh
pnpm migrate:offline    # all twenty
pnpm test               # all twenty, plus the recorded expectations and the round trip
```

One table, one row each: [NOTES.md](NOTES.md#the-catalogue).

`--offline` edits the JSON in `fixtures/`. `git checkout fixtures/` resets it.

## Against a real space

`pnpm migrate:offline` is this playground's stand-in for the CLI, reading and writing
`fixtures/*.json` instead of a space. Same engine, same journal, same undo — only the content store
differs. The shipped commands:

| Playground                               | CLI                                                           |
| :--------------------------------------- | :------------------------------------------------------------ |
| `pnpm migrate:offline --migration 0003…` | `storyblok migrations apply 0003… --space <id>` (`--dry-run`) |
| —                                        | `storyblok migrations list --space <id>`                      |
| `pnpm migrate:offline --undo`            | `storyblok migrations undo --space <id> [--run <id>]`         |

`apply` compiles `.storyblok/migrations/<space>/NNNN-*.ts`, validates every matched story before
writing anything, writes, and records the run. `undo` replays that run's recorded inverse against
whatever the content looks like now, skipping any block that moved on rather than clobbering it.

## Seeing it in a browser

Needs a throwaway space and a personal access token. `pnpm seed` **empties the space** first.

```sh
# .env
STORYBLOK_TOKEN=…
STORYBLOK_SPACE_ID=…
STORYBLOK_PREVIEW_TOKEN=…
```

```sh
pnpm seed                        # reset the space, push schema + content
pnpm dev                         # the site
pnpm migrate --confirm-writes    # migrate the space, then reload
```

## Feedback

- Does a migration read like something you would write and review?
- Is refusing the whole run too strict, or not strict enough?
- Recorded patches roll back exactly; a derived inverse is a blind fallback with
  [known limits](NOTES.md#the-catalogue).
- It ships from `@storyblok/schema/migrations` today, which is
  [open to argument](NOTES.md#where-this-belongs).

Design reasoning, the seed's shape, and known gaps: [NOTES.md](NOTES.md).
