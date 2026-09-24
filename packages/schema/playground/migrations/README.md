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
| `legacy`     | content authored under an older schema: the shapes the migrations move                 |

`legacy` is the story the catalogue migrates. It holds a card with a `title` and a `subtitle`
instead of a `headline`, a card with a headline and no slug, an author with one `name` field, a
price of `"twelve"`, a single `image` where the schema now wants a list, and richtext links still
pointing at a path that moved. The site renders it with gaps, which is what content waiting for a
migration looks like.

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
The committed fixtures were projected from the seed files instead, because no capture has run yet.

`section.accent_color` is the reason. It is a field-type plugin, and a plugin has to be installed
per space before the schema push is accepted. The field now asks for `native-color-picker`, which
the space reports as available, and the playground registers a local plugin for it in
`src/schema/field-plugins.ts` so the value still narrows to a concrete shape. That plugin's value
shape is written to the best understanding available and nothing here verifies it: setting the
colour by hand in the Storyblok UI and reading it back is what would settle it, and a capture is
what would replace these projections.

## The edge-case catalogue

`migrations/` holds twenty migrations, one per case a real project runs into.
`test/catalogue.test.ts` runs every one of them against the committed fixtures with no token, and
asks the same questions of each: does it change something, does it leave the block ids alone, does a
second run move anything, does the inverse the run recorded put the content back, and — where an
inverse can be derived from the ops alone — does that one land in the same place.
`test/expected/<id>.json` records what each migration leaves behind, so a change in behaviour shows
up as a reviewable diff.

| Migration                       | Case                                                | Bites                  |
| :------------------------------ | :-------------------------------------------------- | :--------------------- |
| `0001-rename-card-title`        | one field, renamed everywhere the component appears | `legacy`               |
| `0002-rename-nested-author-bio` | the same block at four depths under three parents   | `home` `team` `legacy` |
| `0003-split-author-name`        | one field into two, with the `merge` counterpart    | `legacy`               |
| `0004-merge-author-name`        | two fields into one, with the `split` counterpart   | `home` `team`          |
| `0005-coerce-card-price`        | a value that will not parse                         | `legacy`               |
| `0006-remove-card-subtitle`     | a field dropped while it still holds text           | `legacy`               |
| `0007-add-card-slug`            | a new field, backfilled from one the block has      | `legacy`               |
| `0008-pin-page-opener`          | a reorder that depends on position, not content     | `home` `team`          |
| `0009-scope-slug-under-card`    | the same block migrated in one location only        | `legacy`               |
| `0010-rename-teaser-block`      | a component folded into another component           | `home` `team`          |
| `0011-single-asset-to-list`     | a field whose type widens, reshaped then renamed    | `home` `team`          |
| `0012-rewrite-richtext-links`   | a mark inside a richtext document                   | `legacy`               |
| `0013-story-link-to-url`        | a multilink that stops pointing at a story          | `home` `legacy`        |
| `0014-translate-card-headline`  | a rewrite that treats German differently            | `legacy`               |
| `0015-rename-category-values`   | values following a renamed datasource               | `pricing` `translated` |
| `0016-wrap-page-body`           | a container level introduced                        | every story            |
| `0017-unwrap-page-sections`     | a container level dissolved                         | all but `pricing`      |
| `0018-toggles`                  | a migration that flips a value — the refusal case   | `home`                 |
| `0019-no-matches`               | a block the schema declares and no story contains   | nothing                |
| `0020-pricing-table-column`     | a column added to a table's header and every row    | `pricing`              |

### What the catalogue found

Twenty cases, and every one of them was expressible without falling back on `alterBlock` for
something a structural op should have done. Two limits showed up, both pinned by a test so they
cannot close or widen unnoticed:

- **Unwrapping a container that nests inside itself does not settle.** `0017` dissolves the sections
  a page holds directly, which lifts the sections that were inside them into the same field, where a
  second run dissolves those too. That much is inherent. What is worth knowing is that nothing
  reports it: the engine checks that an op agrees with itself on a second pass for `alter` ops only,
  so a structural op that keeps moving is neither flagged nor refused, and the run is written.
- **An inverse derived from the ops alone is blind to which blocks were holding the field.** It
  knows a rename happened, never which instances the forward run actually touched, so the mirror op
  sweeps up every block carrying the name now — including the ones that always did. `0001`, `0007`
  and `0010` each show it. This is why the patches a run records take precedence whenever they
  exist, and why a derived inverse is a fallback rather than a rollback.

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
| `pnpm test`            | Run the catalogue and the render checks          |
| `pnpm test:types`      | Type-check the Astro app                         |

`UPDATE_EXPECTED=1 pnpm test` rewrites `test/expected/`. It is the migrated content itself, so it is
only ever rewritten deliberately, and the diff is what the change should be reviewed by.
