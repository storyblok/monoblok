# Content migrations playground

An Astro app on top of a Storyblok space that exists to be migrated. The schema is chosen for
awkwardness rather than realism, and the site renders every block in it. A migration that breaks a
wrap, a reorder, or a translation shows up as a broken page, not just as a failed assertion.

## Setup

```sh
pnpm install
pnpm seed
pnpm dev
```

Set these environment variables, in a local `.env` or in the shell:

| Variable                  | Used by                          |
| :------------------------ | :------------------------------- |
| `STORYBLOK_TOKEN`         | seeding and cleanup (MAPI)       |
| `STORYBLOK_SPACE_ID`      | seeding and cleanup (MAPI)       |
| `STORYBLOK_PREVIEW_TOKEN` | the Astro app (CDA, server-side) |

`pnpm seed` empties the space, pushes the datasources, assets and schema, then pushes the seed
stories. It is destructive: point it at a throwaway space.

## What is deliberately awkward about the schema

| Shape                                   | Where it lives                                                                                    |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------ |
| Containers nested several levels deep   | `page.body` → `section.items` → `section.items`                                                   |
| Richtext holding embedded blocks        | `card.body`, `faq_item.answer`                                                                    |
| Field-level translations (`__i18n__`)   | `card.headline`, `section.heading`, `quote.text`, `media.caption`, `faq_item.question` / `answer` |
| A name that wants splitting and merging | `author.first_name` / `author.last_name`                                                          |
| Single and multi assets                 | `media.image`, `author.avatar` / `card.images`, `gallery.images`                                  |
| Multilinks, both story and url          | `card.link`, `teaser.link`, `quote.source_link`                                                   |
| Datasource-backed options               | `section.theme`, `faq.categories`, `pricing_table.currency`                                       |
| A story-sourced option                  | `card.category`                                                                                   |
| A table                                 | `pricing_table.table`                                                                             |
| A field plugin value                    | `section.accent_color`                                                                            |

## Seed stories

| Slug         | What it carries                                                                        |
| :----------- | :------------------------------------------------------------------------------------- |
| `home`       | loose blocks beside a section, a section inside a section, a card embedded in richtext |
| `team`       | authors at three depths, one with only `first_name`                                    |
| `pricing`    | a table and an FAQ whose answer embeds a card                                          |
| `translated` | `__i18n__de` / `__i18n__fr` siblings, some of them empty                               |

## Fixtures and the offline runner

`fixtures/` holds one JSON file per seed story. `pnpm migrate:offline` runs the migrations in
`migrations/` against those files; `pnpm migrate --confirm-writes` runs the same migrations against
the space. The only difference between the two is which content store the runner is handed, so an
offline run is evidence about a live one. A migration that behaved differently offline would make
every offline check worthless.

Both runs record what they did, so `--undo <run-id>` can replay the inverse. Offline records live
under `fixtures/.journal` and are not committed; live ones live under `.storyblok/migrations`.

Fixtures are generated, never edited by hand:

```sh
pnpm seed && pnpm fixtures   # capture the seeded space
pnpm fixtures --from-seed    # project .storyblok/stories/seed/ without a space
```

The capture is the better source, because it carries whatever the backend normalized on the way in.
The committed fixtures were projected from the seed files instead: `section.accent_color` uses a
field-type plugin that has to be installed per space, and the space available for this playground
does not offer it, so `pnpm seed` cannot push the schema there.

## Commands

| Command                | Action                                           |
| :--------------------- | :----------------------------------------------- |
| `pnpm seed`            | Reset the space and reseed it from `.storyblok/` |
| `pnpm fixtures`        | Regenerate `fixtures/` from the seeded space     |
| `pnpm migrate:offline` | Run the migrations against `fixtures/`           |
| `pnpm migrate`         | Run them against the space (`--confirm-writes`)  |
| `pnpm dev`             | Run the site against the seeded space            |
| `pnpm schema:push`     | Push `src/schema/schema.ts` to the space         |
| `pnpm build`           | Build the site                                   |
| `pnpm test:types`      | Type-check the Astro app                         |
