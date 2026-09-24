# Content migrations playground

An Astro app on top of a Storyblok space that exists to be migrated. The schema is chosen for
awkwardness rather than realism, and the site renders every block in it. A migration that breaks a
wrap, a reorder, or a translation shows up as a broken page, not just as a failed assertion.

## What this is now

This started as a feasibility spike for a `defineMigration` DSL and grew into the prototype. The
engine it exercises is no longer its own: it is the one `@storyblok/schema/migrations` ships, driven
here through the same ops, runner and journal that `storyblok migrations apply | list | undo` drive.
So the playground is two things at once, a demo space you can break on purpose and the place the
design's claims are kept honest, and the reasoning the spike wrote down is at the bottom of this
file rather than in a directory of its own.

**Status: prototype quality, not a shipped API.** Where content migrations ultimately belong is
still open; see [Where this belongs](#where-this-belongs).

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

## Running

| Command                | Action                                           |
| :--------------------- | :----------------------------------------------- |
| `pnpm seed`            | Reset the space and reseed it from `.storyblok/` |
| `pnpm dev`             | Run the site against the seeded space            |
| `pnpm migrate:offline` | Run the migrations against `fixtures/`           |
| `pnpm migrate`         | Run them against the space (`--confirm-writes`)  |
| `pnpm test`            | Run the catalogue and the render checks          |
| `pnpm fixtures`        | Regenerate `fixtures/` from the seeded space     |
| `pnpm schema:push`     | Push `src/schema/schema.ts` to the space         |
| `pnpm build`           | Build the site                                   |
| `pnpm test:types`      | Type-check the Astro app                         |

`pnpm test` and `pnpm migrate:offline` need no token and touch no space.
`UPDATE_EXPECTED=1 pnpm test` rewrites `test/expected/`. That is the migrated content itself, so it
is only ever rewritten deliberately, and the diff is what the change should be reviewed by.

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
now wants a list, richtext links still pointing at a path that moved, and two teasers rather than
one, so a reorder that hoists the page's opener has to pick between them. The site renders it with
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
makes legacy content legacy. The refusal is all-or-nothing and it is over field names, so no flag
satisfies it: a set containing one such story fails as a set. Anyone reproducing a real migration
scenario against a live space meets this. The way around it is not to push such content at all: the
fixture generator reads `.storyblok/stories/offline/` directly, and the catalogue runs offline
against the fixtures.

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
what [`0015`](migrations/0015-rename-category-values.ts) migrates, so its premise survived the
capture rather than depending on the fiction.

Two things the capture did **not** change are worth as much as the three it did. Every block `_uid`
came back exactly as it was written, which is the assumption the whole patch scheme rests on and
which nothing before this had observed against a real space; and `card.price`, a `number` field,
came back as the string `"19"`, which is what [`0005`](migrations/0005-coerce-card-price.ts) says
about coercion.

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
in `src/schema/field-plugins.ts` so the value still narrows to a concrete shape. **That plugin's
value shape is authored, not verified.** It is written to the best understanding available and
nothing here establishes it: setting the color by hand in the Storyblok UI and reading it back is
what would settle it.

## The edge-case catalogue

`migrations/` holds twenty migrations, one per case a real project runs into.
`test/catalogue.test.ts` runs every one of them against the committed fixtures with no token, and
asks the same questions of each: does it change something, does it leave the block ids alone, does a
second run move anything, does the inverse the run recorded put the content back, and, where an
inverse can be derived from the ops alone, does that one land in the same place.
`test/expected/<id>.json` records what each migration leaves behind, so a change in behaviour shows
up as a reviewable diff.

| Migration                                                                      | Case                                                | Bites                  |
| :----------------------------------------------------------------------------- | :-------------------------------------------------- | :--------------------- |
| [`0001-rename-card-title`](migrations/0001-rename-card-title.ts)               | one field, renamed everywhere the component appears | `legacy`               |
| [`0002-rename-nested-author-bio`](migrations/0002-rename-nested-author-bio.ts) | the same block at four depths under three parents   | `home` `team` `legacy` |
| [`0003-split-author-name`](migrations/0003-split-author-name.ts)               | one field into two, with the `merge` counterpart    | `legacy`               |
| [`0004-merge-author-name`](migrations/0004-merge-author-name.ts)               | two fields into one, with the `split` counterpart   | `home` `team`          |
| [`0005-coerce-card-price`](migrations/0005-coerce-card-price.ts)               | a value that will not parse                         | `legacy`               |
| [`0006-remove-card-subtitle`](migrations/0006-remove-card-subtitle.ts)         | a field dropped while it still holds text           | `legacy`               |
| [`0007-add-card-slug`](migrations/0007-add-card-slug.ts)                       | a new field, backfilled from one the block has      | `legacy`               |
| [`0008-pin-page-opener`](migrations/0008-pin-page-opener.ts)                   | a reorder that depends on position, not content     | `home` `legacy` `team` |
| [`0009-scope-slug-under-card`](migrations/0009-scope-slug-under-card.ts)       | the same block migrated in one location only        | `legacy`               |
| [`0010-rename-teaser-block`](migrations/0010-rename-teaser-block.ts)           | a component folded into another component           | `home` `legacy` `team` |
| [`0011-single-asset-to-list`](migrations/0011-single-asset-to-list.ts)         | a field whose type widens, reshaped then renamed    | `home` `legacy` `team` |
| [`0012-rewrite-richtext-links`](migrations/0012-rewrite-richtext-links.ts)     | a mark inside a richtext document                   | `legacy`               |
| [`0013-story-link-to-url`](migrations/0013-story-link-to-url.ts)               | a multilink that stops pointing at a story          | `home` `legacy`        |
| [`0014-translate-card-headline`](migrations/0014-translate-card-headline.ts)   | a rewrite that treats German differently            | `legacy`               |
| [`0015-rename-category-values`](migrations/0015-rename-category-values.ts)     | values following a renamed datasource               | `pricing` `translated` |
| [`0016-wrap-page-body`](migrations/0016-wrap-page-body.ts)                     | a container level introduced                        | every story            |
| [`0017-unwrap-page-sections`](migrations/0017-unwrap-page-sections.ts)         | a container level dissolved, and refused            | all but `pricing`      |
| [`0018-toggles`](migrations/0018-toggles.ts)                                   | a migration that flips a value, the refusal case    | `home`                 |
| [`0019-no-matches`](migrations/0019-no-matches.ts)                             | a block only its `Before` snapshot declares         | nothing                |
| [`0020-pricing-table-column`](migrations/0020-pricing-table-column.ts)         | a column added to a table's header and every row    | `pricing`              |

### What the op set could not express

Nothing, is the short answer. Twenty cases, and every one of them was expressible without falling
back on `alterBlock` for something a structural op should have done. Two limits showed up in how the
engine behaves rather than in what the ops can say. One is fixed, the other is recorded, and a test
pins each so it cannot close or widen unnoticed.

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

### What the catalogue deliberately leaves out

Remapping a story-sourced option's uuid, the shape the capture proved is real. Rewriting one only
means something when the target uuids come from somewhere, and the case anyone actually hits is a
copy of a space where every story has a new uuid. That is a cross-space concern, with its own
mapping input, not a twenty-first row here: the catalogue would have to invent the second space's
uuids, and it would then be testing the fiction the capture just removed.

## The design, as the spike settled it

A migration is a list of ops, plain objects built by imported factories, not a script and not a
chain:

```ts
import { defineMigration, renameField } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";
import type { CardWithTitle } from "../src/schema/snapshots/card-with-title";

export default defineMigration<Schema, CardWithTitle>({
  title: "Rename card.title to card.headline",
  ops: [renameField({ block: "card", field: "title", to: "headline" })],
});
```

### Ops are data

`renameField({…})` returns `{ kind: "renameField", block, field, to }`. Nothing runs at module load,
which is what buys three things at once: a plan can be printed without a network call, a key op
inverts from the op alone (`derive-inverse.ts`), and anyone can add an op by writing a function that
returns one.

The spike's first question was whether the typing survives the move off a builder. A factory is
called in `defineMigration`'s argument list, where the schema appears in no argument, so every type
parameter has to reach it through the contextual return type. It does: the type tests pin a typo in
a field name, a field borrowed from another block, an unknown block, and a rename target the
post-migration schema does not declare, all as compile errors from a bare
`defineMigration<After, Before>([…])`. The cost is a phantom property on every op type, because the
type parameters must occur in the return type for the channel to exist at all.

#### Measured cost: ops compose only where a contextual type reaches them

This is the one place the op list charges for what it buys, and the number is exact: an op has to be
written where `defineMigration`'s parameter type can reach it. Hoist the same correct op into a
variable and it stops compiling.

```ts
const op = removeField({ block: "article", field: "author" });
defineMigration<After, Before>([op]);
// TS2322: RemoveFieldOp<SchemaShape, SchemaShape> is not assignable to
//         RemoveFieldOp<After, Before>
```

With no contextual type the parameters infer to their constraint, `SchemaShape`, and the phantom
brand then blocks the assignment. Two consequences, and the second is the worse one. The error talks
about the brand, never about the name that is actually wrong, and it points at the array element
rather than at the call. And in that position the factory call is unchecked on the way in:
`removeField({ block: "nope", field: "authr" })` raises nothing on its own line, because
`SourceFieldName<SchemaShape, SchemaShape, …>` degrades to `string`.

What still works, all verified: a direct literal;
`BLOCKS.map((block) => removeField({ block, field: "gtm_id" }))`, because the arrow's return
position is contextual; an inline ternary; `satisfies MigrationOps<After, Before>`; and a helper
whose return type is written out as `MigrationOpOf<After, Before>`. So ops compose through callbacks
but not through variables, and the workaround is the explicit annotation the DSL exists to avoid.

Nothing here is fixable inside the op-list shape: it follows from a top-level factory having no
other channel to the schema. A builder does not have the problem, because the handle carries the
generics. That is the trade, stated plainly.

### Two schemas, not one, and `After` first

`Before` types the names the migration reads; `After` types every name and value it writes. One
schema cannot do both: with only the pre-migration schema, `to: "headline"` names a field that does
not exist yet; with only the post-migration schema, `field: "title"` names one that no longer does.

`After` comes first because one type parameter has to mean the schema people actually have, so
`TBefore` defaults to `TAfter` and the single-parameter shorthand is the same signature with the
default filled in: no overload, nothing to wreck. Under that shorthand reads widen to
`… | (string & {})`, so a surviving name autocompletes while one the schema no longer has still
compiles. Writes stay exact either way. The measured cost is pinned as a test: under one schema a
typo in a _source_ name compiles, and `validateMigration` is what catches it, at run time, against
the schema the CLI pulled.

`Before` is a frozen snapshot committed next to the migration, scoped to the blocks the migration
touches. `src/schema/snapshots/` holds this playground's, with its own README on when a migration
needs one.

### The `under` rule, and chains

`under` filters a selection by ancestry, matched anywhere on the ancestor chain rather than on the
direct parent, so wrapping content one level deeper does not break the migration. It takes one block
name, or an outermost-first chain in which each name must appear above the next, gaps allowed:

```ts
alterField({ block: "meta", field: "og_title", under: "card" }, fn);
alterField({ block: "meta", field: "og_title", under: ["section", "card"] }, fn);
```

A key op never takes one. It moves the component schema, which is global, so migrating a subset
would leave every other instance holding a key no schema describes. Three guards enforce that, and
the spike needed all three. The key op specs _declare_ `under`, typed as the sentence explaining the
rule, rather than merely omitting it: excess-property checking fires only on a fresh object literal,
so an omitted key let a spread or a hoisted spec through, and the declared key catches both and
prints the reason. `validateMigration` refuses a migration whose key op carries one anyway, which is
the net for a `.js` migration or an author who cast around the types. And the runner ignores it, so
a key op that slipped past both still applies everywhere instead of half-applying.

This remains the one place the op list is weaker than a builder, whose `.under()` returned a handle
that structurally had no key ops. One rule, three enforcement points, versus one that could not be
expressed wrongly.

### Two sources of an inverse

1. **Recorded patches** (`patch.ts`, `runner.ts`): the run has both trees, so it diffs each touched
   block and stores the inverse. Only these know what the migration actually wrote, so only they can
   tell an editor has since changed the field and skip that block.
2. **Derived inverse** (`derive-inverse.ts`): a pure function of the op list. `renameField` and
   `moveField` invert to their mirror; a coercion inverts only when the author stated `from`.
   `removeField` cannot (the values are gone), and neither `alter` can (the output depends on the
   input). This tier exists only because the op list is data, and it is the one that covers "CI
   applied it, you want it gone locally".

The derived inverse is blind. It cannot see a concurrent edit, and it cannot see which blocks the
run touched, so patches win whenever they exist.

### Why there is no `down`

A schema `down` is symbolic: the inverse of adding a column is dropping it, and you can write it
without reading a row. A content `down` is not. Between the migration running and the rollback,
editors have been editing the very fields the migration touched, so an authored `down` replays a
transformation against content that has moved underneath it.

That makes `down` the weakest of the available inverses while looking like the strongest. A human
wrote it, so a CLI that offered it would be trusted, but it is the only one of the three that knows
neither what the migration wrote nor what has changed since. Recorded patches know both. The derived
inverse knows neither either, but it is a pure function of the op list, so it can be checked, and it
can declare itself underivable instead of guessing.

So `down` is not a third fallback, it is a worse copy of the second with a false claim to authority.
Dropping it also removes a whole reversed schema position from the type surface: `down` had to read
`MigrationOps<Before, After>`, the only place in the API where the two parameters swapped. Where no
inverse exists, you roll forward with a new migration: the same code, reviewed and logged, rather
than dead code nobody has executed.

Every forward-only tool in this space lands in the same place: Sanity, contentful-migration, Prisma
and Drizzle ship no down for data, and Rails documents its auto-inverse as off-limits for data
migrations.

### The journal

Removing `down` leaves recorded patches as the only inverse that knows anything, which makes where
those patches live a load-bearing question rather than a detail. `journal.ts` is the interface:

```ts
interface Journal {
  record(run: MigrationRun, inverse: StoryInverse[]): Promise<void>;
  list(space: string): Promise<MigrationRun[]>;
  read(id: string): Promise<MigrationRun | undefined>;
  readInverse(id: string): Promise<StoryInverse[]>;
}
```

**Two kinds of record, one interface.** A ledger entry is small, one per run, and is what a listing
prints, and it is also what answers "has this migration already run against this space?", a question
that is wrong to answer per-machine. The inverse patches are proportional to the content touched and
are read only during a rollback; a whole-space migration can produce megabytes of them. Keeping them
in separate methods is what lets a remote backend put the entry in a database row and the patches in
blob storage, and what stops `list` from pulling patch bodies to print a table.

They are not separate _interfaces_ because they share an id and a lifecycle: a run writes both or
neither, and a rollback reads both. Splitting them would let a caller store one without the other,
and the failure mode, an entry pointing at patches that were never written, only surfaces during an
incident. `record` takes both for that reason, and implementations write the patches first: an
orphaned patch object is inert, the reverse is not.

`journal-local.ts` is the default, a directory per space with two files per run, which is what both
this playground and the CLI use. A second backend that stores nothing and only logs what it would
send is what the spike used to show the swap, and it is why the runner never reads off a known path.

The patch files want gitignoring. Whether the ledger is committed is a real question and not one
this answers: committing it gives shared "has this run" for free at the cost of a merge conflict on
every run, and a committed ledger records _your machine's_ runs, which is not what anyone means by
shared.

#### Concurrent runs

There is no locking, deliberately. The default backend is a local directory, and two machines do not
share one, which is exactly the case a lock exists for, so a lease that only holds when nobody else
is running would be theater. Lease semantics (TTL, renewal, breaking a lock held by a dead process)
is where an interface like this actually gets decided, and designing it against zero backends that
can enforce it would be guessing.

This is not a regression: the concurrent-run race exists today with no journal at all. A shared
journal makes it easier to notice, not easier to hit.

### Idempotency

Every op runs twice per block and the two results must agree; a disagreement is reported as
`nonIdempotent` and the runner refuses the write. The check began as an `alter`-only check, on the
grounds that a rename is a no-op on the second pass by construction, and `0017` is why it now covers
every kind. The measured cost: an author's callback is invoked twice per block, so it must be free
of side effects.

## Where this belongs

Open, and nothing here decides it.

The engine lives in `@storyblok/schema` because the DSL is parameterised on types only that package
produces, and a subpath export was chosen because it is cheap to move: it is not exported from the
package root, so relocating it later breaks no consumer's import.

The competing homes are `@storyblok/migrations`, which already owns the legacy transform helpers,
and a package under whatever `defineSpace`-style infrastructure-as-code becomes, where schema push,
content migration, datasources and assets would share one lifecycle and one journal. Both are real
arguments, and picking between them is a separate decision from proving the design works.
