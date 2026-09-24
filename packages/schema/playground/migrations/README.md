# Content migrations playground

Content migrations, written in TypeScript against your schema types, applied by the CLI, and
undoable. This playground is a Storyblok space chosen for awkwardness — nested containers, richtext
with embedded blocks, field translations, datasource options, tables — plus twenty migrations that
each break it in a different way, and an Astro site that renders the result so a broken migration
looks broken.

**Status: prototype.** Nothing here is published yet. Feedback on the authoring surface and on the
CLI's behaviour is what this is for.

## Try it in five minutes, no Storyblok account

From the repo root:

```sh
pnpm install
pnpm nx test @storyblok/playground-schema-migrations
```

150 tests. Every one of the twenty migrations is applied to committed content, checked against a
recorded expectation, then rolled back and checked that the content came back.

Then run one by hand, from `packages/schema/playground/migrations`:

```sh
pnpm migrate:offline --migration 0003-split-author-name
# → 0003-split-author-name: migrated legacy
# → 0003-split-author-name: recorded run 2026-09-24T…-0003-split-author-name (1 stories)

git diff fixtures/            # what it did to the content
pnpm migrate:offline --undo 2026-09-24T…-0003-split-author-name
git diff fixtures/            # back where it started
```

`--offline` reads and writes the JSON in `fixtures/`, so this edits files in your checkout.
`git checkout fixtures/` resets it. The undo restores values, not key order, so a diff may still
show keys moved.

Drop `--migration` to run all twenty. One of them (`0017`) is _supposed_ to be refused — the engine
notices the migration does not settle on a second run and declines to write it.

## What a migration looks like

[`migrations/0003-split-author-name.ts`](migrations/0003-split-author-name.ts):

```ts
import { defineMigration, splitField } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";
import type { AuthorWithName } from "../src/schema/snapshots/author-with-name";

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

Blocks and field names are checked against your generated schema types; `AuthorWithName` is a
committed snapshot of the shape the content is in today. Ops are plain data, so the plan is
computable without touching the network, and an inverse can be derived from the op list alone.

The twenty cases, and what each one proves, are tabled in
[NOTES.md](NOTES.md#the-edge-case-catalogue).

## The CLI

```sh
storyblok migrations apply [name] --space <id> [--dry-run]
storyblok migrations list --space <id>
storyblok migrations undo --space <id> [--run <id>]
```

`--run` defaults to the most recent recorded run. `apply` compiles
`.storyblok/migrations/<space>/NNNN-*.ts`, validates every matched story before writing anything,
writes, and records a run. `undo` replays that run's recorded inverse against whatever the content
looks like now, skipping any block that moved on rather than clobbering it.

## Every command

| Command                | Action                                               | Needs a space |
| :--------------------- | :--------------------------------------------------- | :------------ |
| `pnpm test`            | the catalogue and the render checks                  | no            |
| `pnpm migrate:offline` | run the migrations against `fixtures/`               | no            |
| `pnpm seed`            | **empty** the space and reseed it from `.storyblok/` | yes           |
| `pnpm dev`             | the site, against the seeded space                   | yes           |
| `pnpm migrate`         | run the migrations against the space                 | yes           |
| `pnpm fixtures`        | regenerate `fixtures/` from the seeded space         | yes           |

`UPDATE_EXPECTED=1 pnpm test` rewrites `test/expected/`. That is the migrated content itself, so the
diff is what the change should be reviewed by.

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
pnpm migrate --confirm-writes    # migrate the space, then reload the site
```

## Where feedback helps most

- **The authoring surface.** Does a migration read like something you would write and review?
- **The CLI's failure behaviour.** It refuses the whole run when any story would be left in a state
  it cannot roll back. Too strict?
- **Undo.** Recorded patches are exact; a derived inverse is a blind fallback with known limits
  ([NOTES.md](NOTES.md#what-the-op-set-could-not-express)).
- **Where this should live.** It ships from `@storyblok/schema/migrations` today, which is open to
  argument ([NOTES.md](NOTES.md#where-this-belongs)).

Background, design reasoning, and known gaps: [NOTES.md](NOTES.md).
