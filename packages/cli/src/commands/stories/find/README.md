# `storyblok stories find`

Search a space for stories matching a set of filters and print them to stdout as JSONL — one story
per line — ready to pipe into `jq`, save to a file, or feed into another command.

```bash
storyblok stories find "pricing" --space 12345 --publish-status published
```

Filters combine with **AND**. Some are resolved by the API, others locally once a story's content
has been read; which is which matters for speed, and is covered in [Filtering](#filtering).

## Usage

```
storyblok stories find [text] --space <space> [options]
```

### Search and scope

| Option                 | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `[text]`               | Free-text search across the space. Always case-insensitive.        |
| `--search-mode <mode>` | `fulltext` (default). `semantic` is not available yet.             |
| `--entry-type <type>`  | `all` (default), `story` (no folders), or `folder` (folders only). |
| `--starts-with <path>` | Limit the search to a subtree, e.g. `en/blog`. No leading slash.   |

### Filtering

| Option                      | Runs                        | Description                                                                  |
| --------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| `--container-block <name>`  | **API**                     | Stories whose content type (root block) is this component.                   |
| `--includes-block <names>`  | **API**                     | Stories containing these blocks at any depth. Comma-separated.               |
| `-q, --query <query>`       | **API**                     | Filter on root-level content fields.                                         |
| `--where <jsonpath>`        | **Client-side**             | Filter with a JSONPath expression. Repeatable; expressions combine with AND. |
| `--publish-status <status>` | **API** + client-side check | `published`, `changed` (published with unpublished edits), or `draft`.       |

### References

| Option                | Runs            | Description                                                           |
| --------------------- | --------------- | --------------------------------------------------------------------- |
| `--references <uuid>` | **API**         | Stories whose content references this story UUID.                     |
| `--check-references`  | **Client-side** | Report broken references, unpublished targets and outdated link URLs. |

### Optimizations

| Option                   | Description                                                                    |
| ------------------------ | ------------------------------------------------------------------------------ |
| `--skip-content`         | Do not fetch story content; emit list metadata only.                           |
| `--capi-filter`          | Evaluate `--where` against bulk CDN content and fetch only the matches.        |
| `--capi-params <params>` | Extra CDN query parameters for `--capi-filter`, e.g. `'{version: published}'`. |

Both cut how many individual story requests a run has to make, which is what a run actually waits
on, and they combine. See [Optimizations](#optimizations).

Global options apply as usual, including `--space`, `--path`, `--verbose` and `--api-rate-limit`.

## Output

### One story per line on stdout

Each result is a complete
[story object](https://www.storyblok.com/docs/api/management/stories/the-story-object) as the
Management API returns it, printed as a single line of JSON:

```bash
storyblok stories find --space 12345 --container-block product > products.jsonl
```

### Built for Unix pipes

One self-contained document per line is what makes the output composable: line-oriented tools work
on it directly, with no output format to choose and no array to unwrap. This is the intended way to
use the command.

```bash
# Slugs, one per line
storyblok stories find --space 12345 --container-block product | jq -r '.full_slug'

# How many matched
storyblok stories find --space 12345 --container-block product | wc -l

# Just the fields you need saved in JSONL
storyblok stories find --space 12345 --container-block product \
  | jq '{id, name, component: .content.component}' > mystories.jsonl

# CSV for a spreadsheet
storyblok stories find --space 12345 --skip-content \
  | jq -r '[.id, .full_slug, .content_type, .published] | @csv' > inventory.csv

# Group and count with plain shell tools
storyblok stories find --space 12345 --skip-content \
  | jq -r '.content_type' | sort | uniq -c | sort -rn

# Hand the ids to another command
storyblok stories find --space 12345 --query="[archived][is]=true" --skip-content \
  | jq -r '.id' | xargs -I{} storyblok stories delete --space 12345 {}
```

Whenever the progress bars are drawing on a terminal, results are held back until they have stopped,
then written in one go. That covers piping into a tool that prints as it goes:
`… | jq -r .full_slug` would otherwise have `jq` writing to the same terminal the bars are redrawing
on, and the two garble each other.

With stderr redirected or in a non-interactive shell there are no bars to protect, so results stream
out as they match and `… | head -5` prints promptly:

```bash
storyblok stories find --space 12345 2>/dev/null | head -5
```

### Progress on stderr

Progress and the run summary go to stderr, so a run is pipeable without a quiet flag. Discard
results with `> /dev/null` if only the summary is wanted.

```
 Fetching stories             [■■■■■■■■■■] 100% | 0s | 420/420 processed
 Fetching stories content     [■■■■■■■■■■] 100% | 0s | 420/420 processed
 Applying client-side filters [■■■■■■■■■■] 100% | 0s | 420/420 processed

ℹ Results: 34 stories matched (420 fetched, 386 filtered out client-side)
```

The phases shown follow the work being done: `--skip-content` removes the content phase, and
`--capi-filter` adds a filtering phase ahead of it. A phase's total shrinks whenever a story is
decided before reaching it, which is why the counts stop matching the first line.

## Filtering

All filters combine with **AND**, and every one of them runs in one of two places:

| Filter                   | Where it runs                 | Needs story content |
| ------------------------ | ----------------------------- | ------------------- |
| `[text]`                 | API                           | no                  |
| `--entry-type`           | API                           | no                  |
| `--starts-with`          | API                           | no                  |
| `--container-block`      | API                           | no                  |
| `--includes-block`       | API                           | no                  |
| `--query`                | API                           | no                  |
| `--references`           | API                           | no                  |
| `--publish-status`       | API, plus a client-side check | no                  |
| **`--where`**            | **Client-side**               | **usually**         |
| **`--check-references`** | **Client-side**               | **yes**             |

`--where` is the one that depends on the expression. Most reach into `content`, but one written
against story metadata (`full_slug`, `updated_at`, `content_type`, …) is answerable from the listing
alone, and combines with [`--skip-content`](#--skip-content).

**API filters** are resolved by the Storyblok API. They reduce what is transferred and cost nothing
locally, so narrow with them first.

**Client-side filters** are applied by the CLI to each story after it has been fetched. The
evaluation itself is fast — well under a millisecond per story — but both need the story's
`content`, and the listing does not include it. Every story in scope therefore costs one extra
request, and _that_ is what a run waits on. The two [Optimizations](#optimizations) exist for it:
[`--capi-filter`](#--capi-filter) when a `--where` filter is needed,
[`--skip-content`](#--skip-content) when none is.

`--publish-status` sits between the two: the API narrows to published or unpublished stories, and
the CLI then tells `published` from `changed` using the
[`unpublished_changes`](https://www.storyblok.com/docs/api/management/stories/the-story-object) flag
the story listing already carries. No content is fetched for it.

### Free-text search

The positional argument searches the space's stories, always case-insensitively.

```bash
storyblok stories find "pricing" --space 12345
```

### Scope

```bash
# Stories and folders (default)
storyblok stories find --space 12345

# Stories only, or folders only
storyblok stories find --space 12345 --entry-type story
storyblok stories find --space 12345 --entry-type folder

# One subtree
storyblok stories find --space 12345 --starts-with "en/blog"
```

### Blocks

`--container-block` matches a story's content type, `--includes-block` a nestable block used
anywhere inside it — see [Blocks](https://www.storyblok.com/docs/concepts/blocks) for the
difference.

```bash
# Stories whose content type is "product"
storyblok stories find --space 12345 --container-block product

# Stories using a hero or a pricing table anywhere in their content
storyblok stories find --space 12345 --includes-block hero,pricing_table
```

### `--query`

Filters on root-level content fields, using Storyblok's filter query syntax
(`[field][operation]=value`). The API resolves it, so
[filter query operations](https://www.storyblok.com/docs/api/content-delivery/v2/filter-queries/operations)
is the reference for which operators exist and what each one matches.

```bash
# Exact match
storyblok stories find --space 12345 --query="[category][in]=electronics"

# Wildcard (case-insensitive)
storyblok stories find --space 12345 --query="[title][like]=*Headphones*"

# Several conditions, combined with AND
storyblok stories find --space 12345 --query="[featured][is]=true&[price][gt_int]=100"
```

A JSON object is accepted too, which is easier to produce from a script:

```bash
storyblok stories find --space 12345 --query='{"component":{"in":"product"}}'
```

Field and operator names are passed to the API as written, so the API is what decides whether a
query is valid. `--container-block product` is shorthand for `--query="[component][in]=product"`,
and the two combine into a single query.

### `--where`

For everything `--query` cannot express: nested blocks, any-depth search, regular expressions,
`>=`/`<=` comparisons, and story-level properties. Expressions are
[JSONPath (RFC 9535)](https://datatracker.ietf.org/doc/html/rfc9535).

A story matches when the expression selects at least one node. Two rules cover almost every
expression:

- **`@` is the node being tested, not the story.** A filter selects among a node's _children_, so
  `$..[?(@.component == 'hero')]` tests every block inside the story, and `$.stages[?(…)]` tests
  each entry of the `stages` array.
- **Use `$` for story-level properties.** `$[?($.updated_at > '2025-01-01')]` tests the story
  itself. `$[?(@.updated_at > …)]` would instead ask whether any _property value_ of the story has
  an `updated_at`, and never match.

Walking a story means meeting strings, numbers and `null` alongside blocks. Reading a property off
one of those is a non-match rather than an error, so `$..[?(@.fieldtype == 'asset')]` is safe to run
over any content.

Function extensions are available: `match()` and `search()` for regular expressions, plus
`length()`, `count()` and `value()`. Expressions are parsed, never evaluated as JavaScript, so
`--where` cannot execute arbitrary code.

```bash
# Any asset with empty alt text
storyblok stories find --space 12345 --where "$..[?(@.fieldtype == 'asset' && @.alt == '')]"

# Stories updated after a date
storyblok stories find --space 12345 --where "$[?($.updated_at > '2025-01-01')]"

# Regular expression over a nested field
storyblok stories find --space 12345 --where "$..[?match(@.sku, 'SB-[0-9]+')]"

# Narrow with the API first, then refine
storyblok stories find --space 12345 --includes-block hero \
  --where "$..[?(@.component == 'hero' && @.active == false)]"

# Several --where expressions combine with AND
storyblok stories find --space 12345 \
  --where "$..[?(@.component == 'hero' && @.headline != '')]" \
  --where "$..[?(@.component == 'pricing_table' && @.currency == 'EUR')]"
```

### `--publish-status`

| Value       | Matches                                    |
| ----------- | ------------------------------------------ |
| `published` | Published, with no unpublished edits since |
| `changed`   | Published, but with unpublished edits      |
| `draft`     | Never published                            |

```bash
storyblok stories find --space 12345 --publish-status published
storyblok stories find --space 12345 --publish-status changed
storyblok stories find --space 12345 --publish-status draft
```

Because it is decided from the story listing, this filter narrows a search before any content is
fetched — the cheapest kind of narrowing there is. On a 4,000-story space,
`--publish-status changed` can reduce 3,825 stories to 46 without fetching the other 3,779. The
summary reports those as `skipped before fetch`.

## References

Stories point at each other in two ways: through
[reference fields](https://www.storyblok.com/docs/concepts/references) — single- and multi-option
fields holding story UUIDs — and through
[link fields](https://www.storyblok.com/docs/concepts/fields), meaning multilinks and links inside
richtext. Both identify their target by UUID, so `--references` finds either. Only link fields also
keep a cached copy of the target's URL, which is what makes an outdated-URL check possible.

### `--references`

Find every story referencing a given story UUID. Resolved by the API, and it covers all reference
types.

```bash
# Everything pointing at one story
storyblok stories find --space 12345 --references "abc-def-123-456"

# Combined with other filters
storyblok stories find --space 12345 --references "abc-def-123-456" \
  --container-block product --publish-status published
```

### `--check-references`

Checks reference integrity across the searched stories and reports the ones with problems. Reference
fields hold bare UUIDs, so the space's components are loaded first to know which fields are
references; field-level translations of those fields (`author__i18n__de`) are checked too. Targets
outside the search scope are looked up as needed.

Each problem falls into one of three types:

| Type          | Meaning                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| `broken`      | The target UUID does not exist in the space                                     |
| `unpublished` | The target exists but is not published. Folders are exempt, being unpublishable |
| `stale_url`   | A link field's cached URL no longer matches the target's current path           |

Leading and trailing slashes are ignored when comparing paths, so `/about/team` and `about/team/`
count as the same.

Only stories with at least one problem are output, each with a `_ref_issues` array added:

```json
{
  "id": 123,
  "full_slug": "blog/my-post",
  "_ref_issues": [
    {
      "type": "stale_url",
      "ref_type": "multilink",
      "target_uuid": "def-456",
      "cached_url": "/about/old-slug",
      "actual_url": "about/new-slug",
      "field_path": "content.hero.cta_link"
    },
    {
      "type": "broken",
      "ref_type": "relation",
      "target_uuid": "ghi-789",
      "field_path": "content.author"
    }
  ]
}
```

`ref_type` is `multilink`, `richtext` or `relation`. `actual_url` appears only when the target was
found, and `cached_url` only for reference types that carry one, so a relation problem has neither.

`--where` is applied _after_ this enrichment, which is what lets it filter on `_ref_issues`:

```bash
# Audit a whole space
storyblok stories find --space 12345 --check-references

# The same audit, reading content from the CDN in bulk instead of story by story
storyblok stories find --space 12345 --check-references --capi-filter

# Only dead links
storyblok stories find --space 12345 --check-references \
  --where "$._ref_issues[?(@.type == 'broken')]"

# Only outdated URLs, e.g. after a restructure
storyblok stories find --space 12345 --check-references \
  --where "$._ref_issues[?(@.type == 'stale_url')]"

# Published stories pointing at unpublished targets
storyblok stories find --space 12345 --check-references --publish-status published \
  --where "$._ref_issues[?(@.type == 'unpublished')]"
```

## Optimizations

### Where a run's time actually goes

Almost all of it goes into fetching content, and a rate limit is the reason. The Management API's
[story listing](https://www.storyblok.com/docs/api/management/stories/retrieve-multiple-stories)
does not include content, so every story a client-side filter has to see needs a request of its own,
and those requests are paced by `--api-rate-limit` — **six per second** by default.

Here is a real run over a 197-story scope with three `--where` client-side expressions, measured
from outside the command:

| Stage                | Work            | Time       |
| -------------------- | --------------- | ---------- |
| Listing stories      | 2 requests      | 1.5s       |
| Fetching content     | 191 requests    | **31.6s**  |
| Evaluating `--where` | 352 evaluations | 0.8s       |
|                      |                 | wall 32.2s |

The filters account for 0.8 seconds out of 32 — 0.83ms per evaluation. **Client-side filtering is
not what makes a run slow; fetching six stories per second is.**

Neither flag below lifts that limit. Each reduces how many stories have to pass through it, and each
comes with caveats worth reading before it goes into a script.

### `--skip-content`

If nothing in the query needs content, do not fetch it. The content phase disappears entirely and
the run becomes the page walk, which moves 100 stories per request instead of one: the same
167-story scope that takes 29.1s with content takes **4.0s** without it.

The output is the story listing —
[the story object](https://www.storyblok.com/docs/api/management/stories/the-story-object) as the
listing returns it, with slugs, ids, publish state and timestamps, but **no `content` field**. The
`content_summary` digest is included, and is often enough on its own.

Reach for it when the question is "which stories are in scope" rather than "what is inside them":
inventories, slug and ID lists, publish-state counts.

```bash
# Every story under a subtree, as fast as the listing arrives
storyblok stories find --space 12345 --starts-with en/blog --skip-content | jq -r '.full_slug'

# IDs to hand to another command
storyblok stories find --space 12345 --container-block product --skip-content | jq -r '.id'

# Count what an API filter matches, without reading any of it
storyblok stories find --space 12345 --includes-block hero --skip-content | wc -l
```

`--where` still works, as long as the expression stays on metadata. The listing carries every story
property except `content`, so a filter on `full_slug`, `updated_at`, `content_type`, `tag_list` or
`published` needs nothing that was skipped:

```bash
# Every landing page whose slug mentions a partner, in one page walk
storyblok stories find --space 12345 --starts-with lp --skip-content \
  --where "$[?search($.full_slug, 'accelerators')]"

# The content type is on the listing too, so this needs no content
storyblok stories find --space 12345 --skip-content \
  --where "$[?($.content_type == 'product')]"
```

An expression that _does_ read content matches nothing, since the content is not there to read. When
that leaves the run with no results at all, the summary says so:

```
ℹ Results: 0 stories matched (210 listed, no content fetched)
⚠️  --where cannot match on story content while --skip-content is set: the listing
carries story metadata only (full_slug, updated_at, content_type, tag_list,
published, …). If the expression reads content, drop --skip-content, and add
--capi-filter to keep the run fast.
```

Three shapes read content, so none of them survive `--skip-content` on its own:

| Shape                      | Example                            | Why                                                   |
| -------------------------- | ---------------------------------- | ----------------------------------------------------- |
| Naming `content`           | `$[?($.content.component == 'x')]` | reads the field directly                              |
| Recursive descent from `$` | `$..[?(@.component == 'hero')]`    | `..` walks into `content` along with everything else  |
| `@` anchored at the story  | `$[?(@.component == 'hero')]`      | `@` binds to each story property value, `content` too |

Adding [`--capi-filter`](#--capi-filter) gives those expressions a source of content again, without
bringing the per-story fetch back. See
[`--capi-filter` with `--skip-content`](#--capi-filter-with---skip-content).

Good to know:

- **`--check-references` is refused**, since references live in the content it skips, leaving the
  check nothing to read.
- **API filters are unaffected:** free-text search, `--query`, `--container-block`,
  `--includes-block`, `--starts-with`, `--entry-type` and `--references` all still work.
- **`--publish-status` still works**, since it is decided from the listing.
- **Existing pipes may need a look.** `jq '.content.component'` yields `null` per line rather than
  failing, so a script that used to read content will not complain about the change.

### `--capi-filter`

The Content Delivery API returns content in bulk: 25 stories per request, and for pages that size
its rate limit is 50 requests per second — **up to 1,250 stories per second**, against six per
second one at a time through the Management API. `--where` is evaluated against that bulk payload,
so the only stories that still need an individual Management API request are the ones that matched.

```
list stories
      │
read content in bulk from the CDN (25 stories per request)
  └── --where decides which stories match
      │
fetch the matching stories, one request each
      │
    stdout
```

That changes what a run costs. Without the flag it is one request per story **in scope**; with it,
one request per **match**, plus a bulk read fast enough to be rounding error:

```
without --capi-filter:  listing + stories in scope ÷ 6 per second
with --capi-filter:     listing + stories in scope ÷ 1,250 per second + matches ÷ 6 per second
```

So the gain is the **selectivity** of the query — how much of the scope it throws away:

| Scope         | Matched | Without the flag | With `--capi-filter` | Speedup |
| ------------- | ------: | ---------------- | -------------------- | ------- |
| 500 stories   |      50 | 84s              | **10s**              | 8×      |
| 3,951 stories |     100 | 659s (11min)     | **27s**              | 24×     |
| 3,951 stories |   1,000 | 659s             | 177s                 | 3.7×    |
| 3,951 stories |   3,900 | 659s             | 661s                 | none    |

A filter keeping a hundred stories out of four thousand turns eleven minutes into under half a
minute. A filter that keeps almost everything gains nothing and pays a couple of seconds for a bulk
read it could not act on — the worst case is roughly the un-flagged run, not worse than it.

**The bulk pass is where `--where` is decided.** A story it matches is a match, and the filters are
not evaluated a second time once the full story arrives — they have already run against that story's
content. A story it decides against is never fetched at all.

Only stories it _cannot_ decide are filtered later: folders, stories the CDN holds no content for,
and any story in a request that failed. Those are fetched and tested as usual, so nothing reaches
stdout untested.

```bash
# Same question as without the flag, a fraction of the requests
storyblok stories find --space 12345 --starts-with lp --capi-filter \
  --where "$..[?(@.component == 'customers_logos' && count(@.logos_list[*]) >= 6)]"

# Composes with the other filters as usual
storyblok stories find --space 12345 --publish-status published --includes-block hero \
  --capi-filter --where "$..[?(@.component == 'hero' && @.headline == '')]"
```

The summary reports what it saved. Here 170 of 191 stories never needed an individual request, and
the 32.3s run above finished in 4.9s:

```
Filtering via CAPI: 21/191 candidates, 170 pruned before fetch, 0 undecided, 0 batch(es) failed.
Fetching content: 21/21 succeeded, 0 failed.
```

Good to know:

- **The space's [preview token](https://www.storyblok.com/docs/concepts/access-tokens) is used
  automatically**, that being the token type allowed to read drafts. It is resolved before the
  search starts, so a space that does not provide one fails immediately rather than mid-run.
- **Selectivity decides the benefit, so estimate it first.** `--skip-content | wc -l` gives the size
  of the scope; the fewer stories the filter keeps out of that, the bigger the win.
- **CDN caching is a second source of staleness.** A story edited moments ago may still serve its
  previous content, and the decision is made on what is served: such a story can be missed, or
  reported on content that has since changed. A run without the flag reads only the Management API,
  and is always the exact answer.
- **Folders are never discarded**, since the CDN holds no content for them. They are fetched
  individually just like matches, so a folder-heavy scope saves proportionally less; add
  `--entry-type story` when folders are not the target.
- **Draft content carries editor metadata** (`_editable`) that the Management API does not. It never
  reaches the output — it is stripped from the content the CDN supplies to `--check-references` —
  but a `--where` expression mentioning `_editable` matches with the flag and not without it.
- **A failed bulk request costs time, not correctness.** It is reported as a run error, and its
  stories are fetched individually as usual.
- **`--check-references` prunes nothing**, because that check reads every story in scope. The flag
  is still worth passing there: it becomes a bulk content _source_. See
  [`--capi-filter` with `--check-references`](#--capi-filter-with---check-references).

#### `--capi-filter` with `--check-references`

The reference scan has to read every story in scope, so there is nothing to prune. What the flag
does instead is swap the content source: the CDN serves the same draft content in bulk that the
per-story fetch returns one at a time, so the scan reads from there and **no story is fetched from
MAPI**. `--where` is not required, since it is not filtering anything.

```bash
storyblok stories find --space 12345 --starts-with lp --check-references --capi-filter
```

On a 210-story scope that is **2.8s against 36.7s**, reporting the same 27 stories with the same 44
issues down to the field path.

```
Listing stories: 210/210 listed.                                       (done @0.8s)
Reading content via CAPI: 206/210 resolved, 4 without content.         (done @1.5s)
Checking references: 210 checked, 185 with references, 27 with issues. (done @1.5s)
```

Two differences from the un-flagged run, neither of which touches the issues found:

- **The emitted story is the listing plus content**, not the single-story response, so envelope
  fields only that response carries (`breadcrumbs`, `translated_stories`, `preview_token`, `parent`,
  …) are absent, and list-only fields (`content_type`, `content_summary`) are present. `content` and
  `_ref_issues` are identical either way.
- **A story the CDN holds no content for is checked with nothing in hand**, so it reports no
  references. Folders are the usual case and have none anyway; the run says how many:

  ```
  ⚠️  4 stories had no CDN content (folders, stories the CDN holds none for, or a failed
  batch) and were checked without content. Drop --capi-filter to read every story from
  MAPI instead.
  ```

CDN staleness applies here as it does to any `--capi-filter` run: a story edited moments ago may
still serve its previous content, so an audit that has to be exact should drop the flag.

#### `--capi-filter` with `--skip-content`

Combining the two answers a content question and emits list metadata only, which is the fastest
shape a content filter has: the CDN decides every match in bulk, and **no story is fetched from MAPI
at all**. Reach for it when the question is "which stories" rather than "what is in them", and the
answer feeds ids or slugs into something else.

```bash
# Ids of every story using a customers_logos with six or more logos
storyblok stories find --space 12345 --starts-with lp --capi-filter --skip-content \
  --where "$..[?(@.component == 'customers_logos' && count(@.logos_list[*]) >= 6)]" \
  | jq -r '.id'
```

On a 210-story scope that is **1.9s against 20s** with the MAPI fetch, for the same 99 stories.

The trade is what happens to the stories the CDN cannot decide. With the fetch in place they are
settled from MAPI; without it there is nothing left to settle them, so they are tested on list
metadata alone and a content expression drops them. The run says how many:

```
⚠️  4 stories could not be decided from CDN content (folders, stories the CDN holds no
content for, or a failed batch) and were tested on list metadata only. Drop
--skip-content to fetch and test those from MAPI instead.
```

Folders are the usual cause and are rarely the target, so `--entry-type story` often makes the
warning go away on its own.

### `--capi-params`

Extra query parameters for those CDN reads, so anything
[the CDN's story endpoint](https://www.storyblok.com/docs/api/content-delivery/v2/stories/retrieve-multiple-stories)
accepts can be applied to them. Only meaningful together with `--capi-filter`.

Three equivalent forms are accepted:

```bash
--capi-params '{"version":"published","language":"de"}'   # JSON
--capi-params '{version: published, language: de}'        # JSON without the quoting
--capi-params 'version=published,language=de'             # plain pairs (& also separates)
```

- **`version` defaults to `draft`**, which is the content the command reports on. Asking for
  `published` moves the decision to the published content: a story whose draft matches but whose
  published version does not will not be reported, and one whose published version matches will be,
  even if its draft no longer does. Useful when "what is live" is the actual question, misleading
  otherwise.
- **`lang` is accepted as an alias for `language`**, the real parameter name.
- **`by_uuids`, `by_uuids_ordered`, `per_page` and `page` are rejected**, as the command manages
  batching itself.

## Use cases

### Content inventories

```bash
# Where a component is actually used
storyblok stories find --space 12345 --includes-block pricing_table --skip-content \
  | jq -r '.full_slug'

# Every folder in the space
storyblok stories find --space 12345 --entry-type folder --skip-content | jq -r '.full_slug'

# The size of a subtree, before deciding how to process it
storyblok stories find --space 12345 --starts-with en/blog --skip-content | wc -l
```

### Publishing reviews

```bash
# Published stories with unpublished edits, i.e. pending changes
storyblok stories find --space 12345 --publish-status changed --skip-content \
  | jq -r '[.full_slug, .updated_at] | @tsv'

# Drafts that have never gone live, oldest first
storyblok stories find --space 12345 --publish-status draft --skip-content \
  | jq -s 'sort_by(.created_at) | .[] | .full_slug'

# Live but untouched for a long time
storyblok stories find --space 12345 --publish-status published \
  --where "$[?($.updated_at < '2024-01-01')]" | jq -r '.full_slug'
```

### Content quality audits

These read content, which is what `--capi-filter` is for.

```bash
# Images without alt text
storyblok stories find --space 12345 --capi-filter \
  --where "$..[?(@.fieldtype == 'asset' && @.alt == '')]" | jq -r '.full_slug'

# Expensive products missing an SEO description
storyblok stories find --space 12345 --container-block product \
  --query="[price][gt_int]=100&[seo.description][is]=empty" | jq -r '.full_slug'

# Heroes shipped with an empty headline
storyblok stories find --space 12345 --includes-block hero --capi-filter \
  --where "$..[?(@.component == 'hero' && @.headline == '')]" | jq '{slug: .full_slug, id}'

# Published products still mentioning a term that should be gone
storyblok stories find "sale" --space 12345 --container-block product \
  --publish-status published | jq -r '.full_slug'

# Products with EUR pricing above 100 that also have images without alt text
storyblok stories find --space 12345 --container-block product --publish-status published \
  --includes-block pricing_table --capi-filter \
  --where "$..[?(@.component == 'pricing_table' && @.currency == 'EUR' && @.price > 100)]" \
  --where "$..[?(@.fieldtype == 'asset' && @.alt == '')]"
```

### Translation coverage

Storyblok's [internationalization](https://www.storyblok.com/docs/concepts/internationalization)
setups each expose translation state differently, and `--where` reaches all of them.

**Field-level translations** store translated values as
[`<field>__i18n__<lang>` keys](https://www.storyblok.com/docs/api/management/stories/internationalization-for-stories)
inside `content`:

```bash
# German title missing or empty
storyblok stories find --space 12345 --capi-filter \
  --where "$[?(!$.content.title__i18n__de || $.content.title__i18n__de == '')]"

# A field that has been translated into French
storyblok stories find --space 12345 --capi-filter \
  --where "$[?($.content.title__i18n__fr && $.content.title__i18n__fr != '')]"

# Any field missing its German version, at any depth
storyblok stories find --space 12345 --container-block product --capi-filter \
  --where "$..[?(@.description__i18n__de == '')]"
```

**Folder-level translations** put each language under its own path, so `--starts-with` scopes a
search to one language:

```bash
# German stories still in draft
storyblok stories find --space 12345 --starts-with "de/" --publish-status draft

# Published French stories updated after a date
storyblok stories find --space 12345 --starts-with "fr/" --publish-status published \
  --where "$[?($.updated_at > '2025-06-01')]"

# Compare coverage between two languages
storyblok stories find --space 12345 --starts-with "en/" --publish-status published \
  --skip-content | wc -l
storyblok stories find --space 12345 --starts-with "de/" --publish-status published \
  --skip-content | wc -l
```

**Individual translation publishing**, once
[enabled for the space](https://www.storyblok.com/docs/concepts/internationalization), adds a
`translated_stories` array with one entry per language. It is not part of the documented story
object, so here is its shape:

```json
{
  "translated_stories": [
    { "lang": "de", "published_at": "2025-07-09T14:35:26Z", "unpublished_changes": false },
    { "lang": "fr", "published_at": null, "unpublished_changes": true }
  ]
}
```

```bash
# German has never been published
storyblok stories find --space 12345 \
  --where "$.translated_stories[?(@.lang == 'de' && @.published_at == null)]"

# French has unpublished changes
storyblok stories find --space 12345 \
  --where "$.translated_stories[?(@.lang == 'fr' && @.unpublished_changes == true)]"

# German was last published before a date
storyblok stories find --space 12345 \
  --where "$.translated_stories[?(@.lang == 'de' && @.published_at < '2025-01-01')]"
```

**Per-language [workflow](https://www.storyblok.com/docs/manuals/workflows) stages** appear in a
`stages` array, one entry per language, each carrying a `workflow_stage_id`:

```bash
# German at a specific stage
storyblok stories find --space 12345 \
  --where "$.stages[?(@.language == 'de' && @.workflow_stage_id == 42)]"

# Any language at that stage
storyblok stories find --space 12345 --where "$.stages[?(@.workflow_stage_id == 42)]"

# German not yet past review
storyblok stories find --space 12345 \
  --where "$.stages[?(@.language == 'de' && @.workflow_stage_id < 50)]"
```

### Link and reference hygiene

```bash
# Full reference audit, as a repair list
storyblok stories find --space 12345 --check-references \
  | jq '{story: .full_slug, issues: [._ref_issues[] | {type, cached_url, actual_url}]}'

# Outdated link URLs after a slug or folder restructure
storyblok stories find --space 12345 --check-references \
  --where "$._ref_issues[?(@.type == 'stale_url')]" | jq -r '.full_slug'

# What would break if a story were deleted
storyblok stories find --space 12345 --references "abc-def-123-456" --skip-content \
  | jq -r '.full_slug'
```

### Driving other commands

```bash
# Check what a filter matches before acting on it
storyblok stories find --space 12345 --query="[archived][is]=true" --skip-content | wc -l

# Keep a search's matches for later processing
storyblok stories find --space 12345 --container-block product > products.jsonl
```

## The future

**None of this is implemented.** It is where the command is heading, written down so the constraints
do not have to be rediscovered every time someone reaches for them.

### `find` as the discovery engine for other commands

`find` exists to answer one question — _which stories_ — and it now answers it faster and more
precisely than anything else in the CLI. Every other story command answers the same question again,
worse: `stories pull` and `migrations run` have `--starts-with` and `--query` and nothing else, so
"the stories using a `hero` with an empty headline" is not expressible to them at all. The work is
already done one process to the left:

```bash
storyblok stories find --space 12345 --includes-block hero --capi-filter \
  --where "$..[?(@.component == 'hero' && @.headline == '')]" \
  | storyblok migrations run hero --space 12345 -
```

The prize is not fewer requests downstream. It is none. `find` emits the **full story** per line,
content included, so a command reading that stream skips both the listing and the per-story content
fetch and starts at the stage that does the actual work. Today `migrations run` fetches every story
in scope one at a time and only then discovers that the migration changes nothing in most of them —
the no-op verdict is reached _after_ the request that paid for it.

On a 3,951-story space where the migration touches 100 stories:

| Approach                                 | Read                          | Write |    Total |
| ---------------------------------------- | ----------------------------- | ----- | -------: |
| `migrations run` today                   | 3,951 ÷ 6/s = 659s            | 17s   | **676s** |
| `find --capi-filter \| migrations run -` | 27s in `find`, **0** after it | 17s   |  **44s** |

Same result, fifteen times faster, and the filter that selected those 100 stories can be anything
`--where` can express rather than anything `filter_query` can.

`-` is the established convention for "the input is stdin": `git apply -`, `kubectl apply -f -`,
`docker build -`, `tar -f -`.

### Selecting, then acting

The same shape works for writes. `find` selects, something in the middle decides what changes, and a
write command applies it:

```bash
# Retag every story still using the legacy hero
storyblok stories find --space 12345 --includes-block hero_legacy --skip-content \
  | ./retag.js \
  | storyblok stories update --space 12345 -

# Clear out an abandoned campaign subtree
storyblok stories find --space 12345 --starts-with en/campaigns/2023 --skip-content \
  | storyblok stories delete --space 12345 --dry-run -
```

Both sides stay simple, and that is the point: `find` owns the question, the write command owns the
change, and neither has to learn the other's job. The middle is JSONL in, JSONL out — a `jq` filter,
a shell one-liner and a Node script are equal citizens there, and none of them needs a token, a rate
limiter or a progress bar.

`--skip-content` belongs on the left of most of these. A delete needs an `id`, a retag needs
`tag_list`, a move needs `parent_id` — all of them ride on the listing, so the selection side
becomes a page walk of seconds rather than minutes, and the run never reads content it was not going
to touch.

**Run the pipe with `--dry-run` on the right first.** `find` is read-only, so the left side can also
be truncated at any stage to see exactly what the next one would receive.

Neither `stories update` nor `stories delete` exists yet. The pipe is an argument for building them:
once selection is somebody else's problem, there is almost nothing left in a write command but the
write.

Two things a write consumer has to get right, and neither is about the pipe:

- **Deleting a folder deletes its subtree.** The API removes the folder and everything beneath it
  recursively, so a 12-line selection can remove 400 stories, and a child listed after its parent is
  already gone when its turn comes. A delete consumer has to report what it removed rather than how
  many lines it read, and either sort folders last or treat the ids that vanish underneath it as
  expected. `--entry-type story` sidesteps it when the folders themselves should stay.
- **A selection is a snapshot.** Between the `find` and the write, a story can be edited or moved.
  For anything destructive, keep the selection rather than streaming it —
  `find … > selection.jsonl`, read it, act on the file — so the same set can be re-applied, audited
  or diffed afterwards.

### Why `-`, and not just detecting a pipe

The obvious shortcut — read stdin whenever something is on it — fails twice.

First, the usual probe cannot see it. `process.stdin.isTTY` is `null` for a pipe, for `< /dev/null`,
for a file redirect and for a closed descriptor alike, so it cannot tell _piped input_ from _no
input_: under CI, cron, or `docker` without `-i`, stdin is `/dev/null` and a command that guessed
from `isTTY` would silently operate on zero stories and exit 0. `fstat` on descriptor 0 does
distinguish them — a pipe is a FIFO, a redirect is a regular file, and `/dev/null`, a closed
descriptor and a terminal are all character devices — so the detection is available.

Second, and this is the reason it stays explicit: a command that silently consumes stdin breaks when
it is a child of a loop sharing that descriptor.

```bash
cat components.txt | while read component; do
  storyblok migrations run "$component" --space 12345   # would eat the rest of components.txt
done
```

The loop and the command read the same pipe. An auto-detecting `migrations run` would slurp the
remaining lines as JSONL, parse them as stories, and the loop would run once. This is why `ssh` has
`-n`. Stdin also cannot express intent when it conflicts with the scope flags — does
`pull --starts-with en/blog -` intersect them, or does the stream win?

So `-` decides it, and `fstat` is used only for a nudge: when stdin is a pipe, `-` was not passed,
and the command is about to go space-wide, say so on stderr rather than silently doing the larger
thing.

### Steps that stand on their own

Each of these is useful before the pipe exists, and none depends on the others.

- **`--by-ids` / `--by-slugs` on the consuming commands.** The cheap half-step:
  `find … --skip-content | jq -r .id | paste -sd,` feeds it today. One list request per 1,000 ids
  instead of a full page walk, and it composes with `pull`, `validate` and `delete` as well. Content
  still gets re-fetched, so it is a fraction of the win, for a fraction of the work.
- **Larger list pages.** `fetchStoriesStream` asks for 100 stories per page; the Management API
  accepts **1,000**. The same 3,951-story space is 4 list requests instead of 40, in every command
  that shares the stream.
- **The two stages `find` has that nothing else does.** `filterListedStoriesStream` drops stories
  from list metadata alone, before the expensive stage; `capiFilterStream` reads content in bulk and
  prunes. Both take a plain `ClientFilter[]` and neither knows anything about `find`. `pull`,
  `validate` and `migrations run` can all mount them as they are.
- **`migrations run` as its own filter.** A migration function is a pure predicate on content, so it
  can run against bulk CDN content first and only the stories whose content actually changes need a
  Management API read and write. That is `--capi-filter` with the migration in the filter slot.

### What has to be solved first

- **CDN content is not Management API content.** The CDN drops every `field__i18n__<lang>` key from
  the payload. Harmless for a predicate over untranslated fields, a silent undercount when a
  **bloks** field is field-level translated — those nested blocks simply are not in the document the
  filter sees — and never acceptable as the source of a write. The bulk read can decide _which_
  stories; only the Management API can say _what_ is written back.
- **Staleness on the write path.** `migrations run` sends `force_update: "1"`, which overrides the
  server's conflict check. A pipe widens the window between reading a story and writing it, so a
  concurrent edit is lost without a word. The lines already carry `updated_at` — compare it, or drop
  `force_update` for piped input.
- **`find` buffers its output when stderr is a terminal**, so the progress bars cannot be garbled.
  In `find | migrations run -` at an interactive prompt, stderr is still the terminal, so nothing
  reaches the consumer until `find` finishes and the two processes do not overlap. Redirecting
  stderr already fixes it; deciding that a piped consumer outranks the bars would fix it properly.
- **A stated output contract.** `--skip-content` omits content and `--check-references` adds
  `_ref_issues`, so the shape depends on the flags. A consumer needs a documented minimum — `id`,
  `uuid`, `full_slug` — and has to treat `content` as optional, fetching only the lines that lack
  it.
