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

## Commands

| Command            | Action                                           |
| :----------------- | :----------------------------------------------- |
| `pnpm seed`        | Reset the space and reseed it from `.storyblok/` |
| `pnpm dev`         | Run the site against the seeded space            |
| `pnpm schema:push` | Push `src/schema/schema.ts` to the space         |
| `pnpm build`       | Build the site                                   |
| `pnpm test:types`  | Type-check the Astro app                         |
