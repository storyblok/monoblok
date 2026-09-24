# Content migrations: notes

The long form behind [README.md](README.md).

## The space

| Shape                                   | Where                                                                                             |
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

| Story        | Carries                                                                                | Where                         |
| :----------- | :------------------------------------------------------------------------------------- | :---------------------------- |
| `home`       | loose blocks beside a section, a section inside a section, a card embedded in richtext | `.storyblok/stories/seed/`    |
| `team`       | authors at three depths, one with only `first_name`                                    | `.storyblok/stories/seed/`    |
| `pricing`    | a table and an FAQ whose answer embeds a card                                          | `.storyblok/stories/seed/`    |
| `translated` | `__i18n__de` / `__i18n__fr` siblings, some empty                                       | `.storyblok/stories/seed/`    |
| `legacy`     | the pre-migration shape the catalogue migrates                                         | `.storyblok/stories/offline/` |
| `boards`     | three components the schema no longer declares, so it renders only after `0021`        | `.storyblok/stories/offline/` |
| `social`     | a social image still held as a URL in a text field, translations included              | `.storyblok/stories/offline/` |

### You cannot seed pre-migration content

`legacy` lives apart because `stories push` rejects it — and aborts the whole push when it is in the
set:

```
Fields not declared in local schemas:
  - author.name (in stories: legacy)
  - card.image (in stories: legacy)
  - card.subtitle (in stories: legacy)
  - card.title (in stories: legacy)
```

The refusal is over field names and all-or-nothing, so no flag satisfies it: the command that
uploads content validates it against the local schema, and a field the schema does not declare is
exactly what makes content legacy. Anyone reproducing a real migration scenario against a live space
meets this. The fixture generator reads `.storyblok/stories/offline/` directly instead.

## Fixtures

```sh
pnpm seed && pnpm fixtures   # capture the four pushed stories from the space
pnpm fixtures --from-seed    # project .storyblok/stories/seed/ without a space
```

Either way `.storyblok/stories/offline/` is projected and added; it exists nowhere to capture from.
The committed fixtures for the four pushed stories are captured, because a capture carries whatever
the backend normalized on the way in.

`--from-seed` refuses while the committed fixtures are captured, names what it would overwrite, and
takes `--replace-captured`. A capture is told from a projection by the story `id`: the space assigns
it, so an id that does not match the seed file's came back from a space.

### What the capture changed

| Field                                   | Projected              | Captured                                     |
| :-------------------------------------- | :--------------------- | :------------------------------------------- |
| `card.category`, a story-sourced option | `"story-team"`, a slug | `"01e738c0-…"`, the story's uuid             |
| `card.link.id`, a story multilink       | `"story-team"`         | the same uuid, with the slug in `cached_url` |
| any asset's `filename` and `id`         | `""` and `2000`        | a CDN URL and the space's own asset id       |

Three projected values were fiction. The API stores what it is sent, so authoring a slug into a
story-sourced option and reading it back proves only that the API kept it.

Unchanged, and worth as much: every block `_uid` came back exactly as written — the assumption the
whole patch scheme rests on — and `card.price`, a `number` field, came back as the string `"19"`,
which is [`0005`](migrations/0005-coerce-card-price.ts)'s premise. `faq.categories` still holds
`"billing"` and `"general"`, so [`0015`](migrations/0015-rename-category-values.ts) survived too.

Key order differs throughout, so the tests compare parsed values, not text.

Two things stay authored, not verified: `legacy`'s asset and story link (copied from captured
content, but not captured), and the `native-color-picker` value shape behind `section.accent_color`
(`src/schema/field-plugins.ts`). Setting the color by hand in the UI and reading it back is what
would settle the second.

## The catalogue

`test/catalogue.test.ts` runs all twenty-two against the committed fixtures, no token, asking each:
does it change something, does it leave the block ids alone, does a second run move anything, does
the recorded inverse put the content back, and — where one can be derived from the ops alone — does
that one land in the same place. `test/expected/<id>.json` is the reviewable diff.

| Migration                                                                                | Case                                                | Bites                  |
| :--------------------------------------------------------------------------------------- | :-------------------------------------------------- | :--------------------- |
| [`0001-rename-card-title`](migrations/0001-rename-card-title.ts)                         | one field, renamed everywhere the component appears | `legacy`               |
| [`0002-rename-nested-author-bio`](migrations/0002-rename-nested-author-bio.ts)           | the same block at four depths under three parents   | `home` `team` `legacy` |
| [`0003-split-author-name`](migrations/0003-split-author-name.ts)                         | one field into two, with the `merge` counterpart    | `legacy`               |
| [`0004-merge-author-name`](migrations/0004-merge-author-name.ts)                         | two fields into one, with the `split` counterpart   | `home` `team`          |
| [`0005-coerce-card-price`](migrations/0005-coerce-card-price.ts)                         | a value that will not parse                         | `legacy`               |
| [`0006-remove-card-subtitle`](migrations/0006-remove-card-subtitle.ts)                   | a field dropped while it still holds text           | `legacy`               |
| [`0007-add-card-slug`](migrations/0007-add-card-slug.ts)                                 | a new field, backfilled from one the block has      | `legacy`               |
| [`0008-pin-page-opener`](migrations/0008-pin-page-opener.ts)                             | a reorder that depends on position, not content     | `home` `legacy` `team` |
| [`0009-scope-slug-under-card`](migrations/0009-scope-slug-under-card.ts)                 | the same block migrated in one location only        | `legacy`               |
| [`0010-rename-teaser-block`](migrations/0010-rename-teaser-block.ts)                     | a component folded into another component           | `home` `legacy` `team` |
| [`0011-single-asset-to-list`](migrations/0011-single-asset-to-list.ts)                   | a field whose type widens, reshaped then renamed    | `home` `legacy` `team` |
| [`0012-rewrite-richtext-links`](migrations/0012-rewrite-richtext-links.ts)               | a mark inside a richtext document                   | `legacy`               |
| [`0013-story-link-to-url`](migrations/0013-story-link-to-url.ts)                         | a multilink that stops pointing at a story          | `home` `legacy`        |
| [`0014-translate-card-headline`](migrations/0014-translate-card-headline.ts)             | a rewrite that treats German differently            | `legacy`               |
| [`0015-rename-category-values`](migrations/0015-rename-category-values.ts)               | values following a renamed datasource               | `pricing` `translated` |
| [`0016-wrap-page-body`](migrations/0016-wrap-page-body.ts)                               | a container level introduced                        | every story            |
| [`0017-unwrap-page-sections`](migrations/0017-unwrap-page-sections.ts)                   | a container level dissolved, and refused            | all but `pricing`      |
| [`0018-toggles`](migrations/0018-toggles.ts)                                             | a migration that flips a value, the refusal case    | `home`                 |
| [`0019-no-matches`](migrations/0019-no-matches.ts)                                       | a block only its `Before` snapshot declares         | nothing                |
| [`0020-pricing-table-column`](migrations/0020-pricing-table-column.ts)                   | a column added to a table's header and every row    | `pricing`              |
| [`0021-link-boards-to-content-boards`](migrations/0021-link-boards-to-content-boards.ts) | three components renamed at once, fields and all    | `boards`               |
| [`0022-og-image-url-to-asset`](migrations/0022-og-image-url-to-asset.ts)                 | a value built from data the content does not hold   | `boards` `social`      |

**Could the op set express all twenty-two? Yes** — none of them fell back on `alterBlock` for
something a structural op should have done. Four limits surfaced in the engine and its types
instead, each pinned by a test.

**Non-settling ops are reported whatever their kind (fixed).** The check used to cover the `alter`
ops only, on the grounds that a rename is a no-op on the second pass by construction. `0017` is a
structural op that does not settle, and was neither flagged nor refused.

**A derived inverse is blind to which blocks held the field (recorded, not fixed).** `deriveInverse`
knows a rename happened, never which instances the run touched, so the mirror op sweeps up every
block carrying the name now:

- `0001` renames a card born with a `headline` to a `title` it never had.
- `0007`'s inverse strips a slug from cards that always had one — and the engine calls it non-lossy.
- `0010` the same, for a component name.

The fix is marking `renameField`, `renameBlock`, and `addField` lossy, left for a separate change
because it moves what the CLI refuses without an opt-in. Recorded patches name only the blocks the
run changed, so a rollback from them is exact either way.

**A field rename on a component being renamed away is unchecked (recorded, not fixed).** `to`
resolves against the post-migration schema under the pre-migration block name, which that schema no
longer declares, so it widens to `string`. `0021` renames three components and four of their fields
in one migration and gets no target-name checking on any of them; splitting it into a field
migration and a component migration is what buys the check back.

**An op callback sees the value and nothing else (recorded, not fixed).** The callbacks are
synchronous and are handed a value and its key, never the space or a client, so a migration whose
new value depends on data the content does not hold has to resolve that data before any op runs.
`0022` builds an asset object out of a URL, and everything else an asset object carries — its id,
alt text, title, whether it is private — has to come from the space's asset list. In a real run that
list is fetched at module scope, which means importing the migration performs the request,
`storyblok migrations list` included. A per-run context the runner awaits once and passes to each
callback is the fix; it is not in this prototype.

**Not covered:** remapping a story-sourced option's uuid. It only means something when the target
uuids come from somewhere, and the real case is a copied space where every story has a new uuid — a
cross-space concern with its own mapping input.

## Design

### Ops are data

```ts
renameField({ block: "card", field: "title", to: "headline" });
// → { kind: "renameField", block: "card", field: "title", to: "headline" }
```

Nothing runs at module load. So a plan prints without a network call, a key op inverts from the op
alone, and anyone can add an op by writing a function that returns one.

The cost is a phantom property on every op type: the schema reaches a factory only through the
contextual return type, so the type parameters must occur there. Which means ops compose only where
that contextual type reaches them:

```ts
// Works: direct literal, .map() callback, ternary, `satisfies MigrationOps<After, Before>`,
// or a helper whose return type is written out as MigrationOpOf<After, Before>.
defineMigration<After, Before>([removeField({ block: "article", field: "author" })]);

// Does not: hoisted into a variable.
const op = removeField({ block: "article", field: "author" });
defineMigration<After, Before>([op]);
// TS2322: RemoveFieldOp<SchemaShape, SchemaShape> is not assignable to
//         RemoveFieldOp<After, Before>
```

The error names the brand, not the field, and points at the array element rather than the call. In
that position the factory call is also unchecked on the way in —
`removeField({ block: "nope", field: "authr" })` raises nothing on its own line, because
`SourceFieldName<SchemaShape, …>` degrades to `string`. A builder does not have this problem: the
handle carries the generics.

### Two schemas, `After` first

```ts
defineMigration<Schema, CardWithTitle>({ … });   // reads CardWithTitle, writes Schema
defineMigration<Schema>({ … });                  // TBefore defaults to TAfter
```

One schema cannot do both: with only the old one, `to: "headline"` names a field that does not exist
yet; with only the new one, `field: "title"` names one that no longer does. `After` comes first so
the single-parameter form is the same signature with the default filled in — no overload.

Under the shorthand, reads widen to `… | (string & {})`: a surviving name autocompletes, a dropped
one still compiles, and `validateMigration` catches the typo at run time against the schema the CLI
pulled. Writes stay exact either way. A test pins that cost.

`Before` is a frozen snapshot committed beside the migration, scoped to the blocks it touches —
`src/schema/snapshots/`, with its own README on when one is needed.

### `under`

```ts
alterField({ block: "meta", field: "og_title", under: "card" }, fn);
alterField({ block: "meta", field: "og_title", under: ["section", "card"] }, fn);
```

Matched anywhere on the ancestor chain, not just the direct parent, so wrapping content one level
deeper does not break the migration. A chain is outermost-first, gaps allowed.

A key op never takes one — it moves the component schema, which is global, so migrating a subset
leaves every other instance holding a key no schema describes. Three guards, all of which the spike
needed:

1. Key op specs **declare** `under`, typed as the sentence explaining the rule. Excess-property
   checking fires only on a fresh object literal, so merely omitting it let a spread or hoisted spec
   through.
2. `validateMigration` refuses one anyway — the net for a `.js` migration or a cast.
3. The runner ignores it, so one that slipped past both applies everywhere rather than
   half-applying.

One rule, three enforcement points, versus a builder's `.under()` returning a handle that
structurally has no key ops.

### Two sources of an inverse

1. **Recorded patches** — the run has both trees, diffs each touched block, stores the inverse. Only
   these know what the migration actually wrote, so only they can tell that an editor has since
   changed the field and skip that block.
2. **Derived inverse** — a pure function of the op list. `renameField` and `moveField` invert to
   their mirror; a coercion inverts only when the author stated `from`; `removeField` cannot, and
   neither `alter` can. Covers "CI applied it, you want it gone locally".

Patches win whenever they exist.

### Why there is no `down`

A schema `down` is symbolic — the inverse of adding a column is dropping it, no rows read. A content
`down` is not: between the run and the rollback, editors have been editing the very fields the
migration touched.

That makes `down` the weakest available inverse while looking like the strongest. A human wrote it,
so it would be trusted, and it is the only one of the three that knows neither what the migration
wrote nor what changed since. It also drags a reversed schema position into the type surface —
`MigrationOps<Before, After>`, the only place the parameters swap. Where no inverse exists, roll
forward with a new migration.

Sanity, contentful-migration, Prisma and Drizzle ship no down for data; Rails documents its
auto-inverse as off-limits for data migrations.

### The journal

```ts
interface Journal {
  record(run: MigrationRun, inverse: StoryInverse[]): Promise<void>;
  list(space: string): Promise<MigrationRun[]>;
  read(id: string): Promise<MigrationRun | undefined>;
  readInverse(id: string): Promise<StoryInverse[]>;
}
```

Two kinds of record, one interface. A ledger entry is small, one per run, and answers "has this
migration already run against this space?" — a question that is wrong to answer per-machine. The
inverse patches scale with the content touched (megabytes for a whole-space run) and are read only
during a rollback. Separate methods let a remote backend put the entry in a row and the patches in
blob storage, and stop `list` from pulling patch bodies to print a table.

Not separate _interfaces_, because they share an id and a lifecycle: a run writes both or neither.
`record` takes both, and implementations write the patches first — an orphaned patch object is
inert, an entry pointing at patches that were never written is a rollback that fails when needed.

`journal-local.ts` is the default: a directory per space, two files per run. The patch files want
gitignoring. Whether the ledger is committed is open — it buys shared "has this run" at the cost of
a merge conflict per run, and records _your machine's_ runs, which is not what anyone means by
shared.

**No locking, deliberately.** The default backend is a local directory and two machines do not share
one, which is the case a lock exists for. Lease semantics — TTL, renewal, breaking a lock held by a
dead process — is where such an interface gets decided, and designing it against zero backends that
can enforce it would be guessing. The race exists today with no journal at all; a shared journal
makes it easier to notice, not easier to hit.

### Idempotency

Every op runs twice per block and the results must agree, or the runner refuses the write. Cost: an
author's callback is invoked twice per block, so it must be free of side effects.

## Known gaps

Neither is visible from the fixtures, so nothing here fails when you hit them. Both cost you a
rollback.

**A save from the editor writes fields nobody typed in.** Opening a story and saving it backfills
the field type's empty value into every field the form shows — `""`, `false`, `[]`, an empty
multilink, asset, or richtext document. A key that was absent comes back as `""`. Blocks not in the
form are left alone. So a migration that unset a field can find it back as `""`, and the inverse
`set` conflicts on `expect: undefined`, on exactly the stories real editors touched. Surviving an
active space means treating "key absent becomes the field type's empty value" as a non-conflict.

**The draft is not the only copy of a story.** A publish copies the draft, so a migration touching
only the draft leaves the published version on the old shape until someone publishes — and a
draft-only rollback returns the draft while the published version keeps the new shape. A release is
a separate content record, invisible to the plain story endpoints, and deploying it later overwrites
the draft wholesale, migration included.

## Where this belongs

Open. The engine lives in `@storyblok/schema` because the DSL is parameterised on types only that
package produces, and a subpath export is cheap to move: nothing is exported from the package root,
so relocating it breaks no consumer's import.

The competing homes are `@storyblok/migrations`, which already owns the legacy transform helpers,
and a package under whatever `defineSpace`-style infrastructure-as-code becomes, where schema push,
content migration, datasources and assets would share one lifecycle and one journal.
