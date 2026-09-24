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
| A story-sourced option (stores a uuid)  | `card.category`                                                                                   |
| A table                                 | `pricing_table.table`                                                                             |
| A field plugin value                    | `section.accent_color`                                                                            |

## Seed stories

| Slug         | What it carries                                                                        |
| :----------- | :------------------------------------------------------------------------------------- |
| `home`       | loose blocks beside a section, a section inside a section, a card embedded in richtext |
| `team`       | authors at three depths, one with only `first_name`                                    |
| `pricing`    | a table and an FAQ whose answer embeds a card                                          |
| `translated` | `__i18n__de` / `__i18n__fr` siblings, some of them empty                               |

Those four live in `.storyblok/stories/seed/` and are what `pnpm seed` pushes.

### The story the push will not take

`legacy` is the story the catalogue migrates, and it lives apart, in `.storyblok/stories/offline/`.
It holds a card with a `title` and a `subtitle` instead of a `headline`, a card with a headline and
no slug, an author with one `name` field, a price of `"twelve"`, a single `image` where the schema
now wants a list, and richtext links still pointing at a path that moved. The site renders it with
gaps, which is what content waiting for a migration looks like.

It is separate because `storyblok stories push` refuses it, and aborts the whole push when it is in
the pushed set:

```
Fields not declared in local schemas:
  - author.name (in stories: legacy)
  - card.image (in stories: legacy)
  - card.subtitle (in stories: legacy)
  - card.title (in stories: legacy)
```

That is the tool working as designed, and it is worth stating on its own: **you cannot seed a
pre-migration state through `stories push`**, because the command that uploads content validates it
against the local schema and rejects any field the schema does not declare, which is exactly what
makes legacy content legacy. Anyone reproducing a real migration scenario against a live space meets
this. The way around it is not to push such content at all: the fixture generator reads
`.storyblok/stories/offline/` directly, and the catalogue runs offline against the fixtures.

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
pnpm seed && pnpm fixtures   # capture the four pushed stories from the space
pnpm fixtures --from-seed    # project .storyblok/stories/seed/ without a space
```

Either way, `.storyblok/stories/offline/` is projected and added, because its stories exist nowhere
else to capture from.

For the four pushed stories the capture is the better source, because it carries whatever the
backend normalized on the way in. The committed fixtures for those four are captured.

### What the capture changed, and why projections are not enough

The four stories were projections until a real capture ran. Comparing the two is the argument for
the capture, because a projection is only ever what we wrote down, and three of the values we wrote
down were wrong:

| Field                                   | Projected              | Captured                                     |
| :-------------------------------------- | :--------------------- | :------------------------------------------- |
| `card.category`, a story-sourced option | `"story-team"`, a slug | `"01e738c0-…"`, the story's uuid             |
| `card.link.id`, a story multilink       | `"story-team"`         | the same uuid, with the slug in `cached_url` |
| any asset's `filename` and `id`         | `""` and `2000`        | a CDN URL and the space's own asset id       |

A story-sourced option stores the story's **uuid**, not its slug. That is exactly the class of shape
authoring can never establish: the API stores what it is sent, so writing a slug there and reading
it back proves only that the API kept it. Every projected fixture was fiction on this point, and any
migration reasoning about such a value was being tested against content no space would hold.

A datasource-backed option is not the same thing and was not fiction: `faq.categories` still holds
`"billing"` and `"general"`, the datasource entries' own values, which the capture confirms. That is
what `0015` migrates, so its premise survived the capture rather than depending on the fiction.

Two things the capture did **not** change are worth as much as the three it did. Every block `_uid`
came back exactly as it was written, which is what the whole patch scheme rests on; and
`card.price`, a `number` field, came back as the string `"19"`, which is what `0005` says about
coercion.

Key order differs throughout, which is why the tests compare parsed values rather than text.

`.storyblok/stories/offline/legacy_story-legacy.json` cannot be captured, so its asset and its story
link were rewritten by hand to the shapes the capture revealed. They are copied from captured
content rather than invented, but they are still authored, and only a capture would make them
evidence.

`pnpm fixtures --from-seed` would replace the captured fixtures with projections and lose all of the
above, so it refuses to run while the committed fixtures are captured. It names the stories it would
overwrite and what to run instead. Pass `--replace-captured` to go ahead anyway, which is the right
thing when no space is available and a projection is the best that can be had.

A capture is told from a projection by the story's `id`: the space assigns it, so a fixture whose id
is not the one its seed file carries came back from a space. The stories under
`.storyblok/stories/offline/` have no seed file, and nothing can push or capture them, so they never
count either way.

`section.accent_color` used to block even the schema push. It is a field-type plugin, and a plugin
has to be installed in a space before the push is accepted. The field now asks for
`native-color-picker`, which the space accepts, and the playground registers a local plugin for it
in `src/schema/field-plugins.ts` so the value still narrows to a concrete shape. That plugin's value
shape is written to the best understanding available and nothing here verifies it: setting the color
by hand in the Storyblok UI and reading it back is what would settle it.

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
| `0017-unwrap-page-sections`     | a container level dissolved, and refused            | all but `pricing`      |
| `0018-toggles`                  | a migration that flips a value, the refusal case    | `home`                 |
| `0019-no-matches`               | a block the schema declares and no story contains   | nothing                |
| `0020-pricing-table-column`     | a column added to a table's header and every row    | `pricing`              |

### What the catalogue found

Twenty cases, and every one of them was expressible without falling back on `alterBlock` for
something a structural op should have done. Two limits showed up. One is fixed, the other is
recorded, and a test pins each so it cannot close or widen unnoticed.

**An op that does not settle is now reported whatever its kind (fixed).** `0017` dissolves the
sections a page holds directly, which lifts the sections that were inside them into the same field,
where a second run dissolves those too. No callback is involved: the op does not settle on this
content, however carefully it was written. The engine used to check agreement on a second pass for
the `alter` ops only, so this was neither flagged nor refused and the run was written, while a
value-flipping mistake of the same severity was caught. The check now covers every op kind, so
`0017` is reported and the runner declines to write it. That is what the row demonstrates.

**A derived inverse is blind to which blocks were holding the field (recorded, not fixed).**
`deriveInverse` knows that a rename happened, never which instances the forward run touched, so the
mirror op sweeps up every block carrying the name now, including the ones that always did. A card
born with a `headline` is renamed to a `title` it never had, and `addField`'s inverse strips a slug
from cards that always had one, which the engine currently calls non-lossy. `0001`, `0007`, and
`0010` each show it, and a test pins the set to exactly those three.

The fix is to mark `renameField`, `renameBlock`, and `addField` as lossy, which is left for a
separate change because it moves what the CLI refuses without an opt-in. Nothing about the patches a
run records is affected: they name the blocks the run actually changed, so a rollback from them is
exact either way. This is why recorded patches take precedence, and why a derived inverse is a
fallback rather than a rollback.

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
