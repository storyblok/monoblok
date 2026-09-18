# `storyblok stories find`

Search a space for stories matching a set of filters and print them to stdout as JSONL, one story
per line, ready to pipe into `jq`, save to a file, or feed into another command.

```bash
storyblok stories find "pricing" --space 12345 --publish-status published
```

- [API reference](#api-reference): every option, what it matches, and where it runs
- [Output](#output): the JSONL lines, pipes, annotations, and progress
- [Common use cases](#common-use-cases): the questions teams actually ask a space
- [Optimizations](#optimizations): `--skip-content`, `--capi-filter`, and when to reach for each
- [Best practices](#best-practices): how to build a query that stays fast and correct
- [Caveats](#caveats): what can make an answer wrong, and what to do about it

## API reference

### Usage

```
storyblok stories find [text] --space <space> [options]
```

Reads. Never writes. Every option is optional except `--space`, which can also come from the
environment or config like it does for every other command.

### Search and scope

What the run looks at before any filter is applied.

| Option                 | Value                        | Default | Runs | Description                                                           |
| ---------------------- | ---------------------------- | ------- | ---- | --------------------------------------------------------------------- |
| `[text]`               | string                       | -       | API  | Free-text search across the space's stories. Always case-insensitive. |
| `-s, --space <space>`  | space ID                     | config  | -    | The space to search. Required.                                        |
| `--entry-type <type>`  | `all` \| `story` \| `folder` | `all`   | API  | Narrow to stories only, or folders only.                              |
| `--starts-with <path>` | slug prefix                  | -       | API  | Limit the search to one subtree, e.g. `en/blog`. No leading slash.    |

### Filters

All of these combine with **AND**, both with each other and with the scope above.

| Option                      | Value                               | Runs         | Needs content | Description                                                            |
| --------------------------- | ----------------------------------- | ------------ | ------------- | ---------------------------------------------------------------------- |
| `--container-block <name>`  | component name                      | API          | no            | Stories whose content type (root block) is this component.             |
| `--includes-block <names>`  | comma-separated                     | API          | no            | Stories containing these blocks at any depth. **All** must be present. |
| `-q, --query <query>`       | filter query or JSON                | API          | no            | Filter on root-level content fields.                                   |
| `--tag <names>`             | comma-separated                     | API          | no            | Stories carrying **any** of these tags.                                |
| `--workflow-stage <ids>`    | comma-separated                     | API          | no            | Stories at **any** of these workflow stage IDs.                        |
| `--publish-status <status>` | `published` \| `changed` \| `draft` | API + client | no            | Publish state, decided from the story listing.                         |
| `--where <jsonpath>`        | JSONPath (RFC 9535)                 | client       | usually       | Anything `--query` cannot express. Repeatable; combines with AND.      |

### References

| Option                 | Value           | Runs   | Description                                                           |
| ---------------------- | --------------- | ------ | --------------------------------------------------------------------- |
| `--references <uuids>` | comma-separated | API    | Stories whose content references **all** of these story UUIDs.        |
| `--check-references`   | flag            | client | Report broken references, unpublished targets and outdated link URLs. |

### Order and size

| Option            | Value           | Default | Description                                                              |
| ----------------- | --------------- | ------- | ------------------------------------------------------------------------ |
| `--sort <fields>` | comma-separated | -       | Order results server-side, e.g. `updated_at:desc`.                       |
| `--limit <n>`     | integer ≥ 1     | -       | Stop once `n` results are printed, leaving the rest of the scope unread. |

### Optimization flags

| Option                   | Value  | Description                                                                    |
| ------------------------ | ------ | ------------------------------------------------------------------------------ |
| `--skip-content`         | flag   | Do not fetch story content; emit list metadata only.                           |
| `--capi-filter`          | flag   | Evaluate `--where` against bulk CDN content and fetch only the matches.        |
| `--capi-params <params>` | string | Extra CDN query parameters for `--capi-filter`, e.g. `'{version: published}'`. |

Both cut the number of individual story requests a run has to make, which is what a run actually
waits on, and they combine. See [Optimizations](#optimizations).

---

### `[text]`

Searches the space's stories, always case-insensitively. Resolved by the API.

```bash
storyblok stories find "pricing" --space 12345
```

### `--entry-type`

```bash
storyblok stories find --space 12345                       # stories and folders (default)
storyblok stories find --space 12345 --entry-type story    # stories only
storyblok stories find --space 12345 --entry-type folder   # folders only
```

`--entry-type story` is worth passing under `--capi-filter`: the CDN holds no content for a folder,
so folders are the one thing that stage can never prune.

### `--starts-with`

```bash
storyblok stories find --space 12345 --starts-with "en/blog"
```

### `--container-block` and `--includes-block`

`--container-block` matches a story's content type; `--includes-block` matches a nestable block used
anywhere inside it. See [Blocks](https://www.storyblok.com/docs/concepts/blocks) for the difference.
Both are resolved by the API.

Several names in `--includes-block` compose with **AND**: the story has to contain every one of
them. To find stories using any one of a set, run the command once per block and concatenate.

```bash
# Stories whose content type is "product"
storyblok stories find --space 12345 --container-block product

# Stories using both a hero and a pricing table anywhere in their content
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

# A JSON object, which is easier to produce from a script
storyblok stories find --space 12345 --query='{"component":{"in":"product"}}'
```

Field and operator names are passed to the API as written, so the API is what decides whether a
query is valid. `--container-block product` is shorthand for `--query="[component][in]=product"`,
and the two combine into a single query, field by field, so clauses on other fields survive. Setting
the same field and operator from both flags is a usage error rather than a silent last-one-wins.
Input that parses to nothing is rejected too: a `--query` with no readable clause would send no
filter at all and quietly return the whole space.

### `--where`

For everything `--query` cannot express: nested blocks, any-depth search, regular expressions,
`>=`/`<=` comparisons, and story-level properties. Expressions are based on
[JSONPath (RFC 9535)](https://datatracker.ietf.org/doc/html/rfc9535).

A story matches when the expression selects at least one node. Two rules cover almost every
expression:

- **`@` is the node being tested.** A filter selects among a node's _children_, so
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
# Stories with any asset with empty alt text
storyblok stories find --space 12345 --where "$..[?(@.fieldtype == 'asset' && @.alt == '')]"

# Stories updated after a date
storyblok stories find --space 12345 --where "$[?($.updated_at > '2025-01-01')]"

# Regular expression over a nested field
storyblok stories find --space 12345 --where "$..[?match(@.sku, 'SB-[0-9]+')]"

# Narrow with the server-side API filters first, then refine
storyblok stories find --space 12345 --includes-block hero \
  --where "$..[?(@.component == 'hero' && @.active == false)]"

# Several --where expressions combine with AND
storyblok stories find --space 12345 \
  --where "$..[?(@.component == 'hero' && @.headline != '')]" \
  --where "$..[?(@.component == 'pricing_table' && @.currency == 'EUR')]"
```

Most expressions reach into `content`, which the story listing does not carry. That is the request
per story the [Optimizations](#optimizations) exist to avoid. One written against story metadata
(`full_slug`, `updated_at`, `content_type`, `tag_list`, `published`, …) is answerable from the
listing alone and combines with [`--skip-content`](#--skip-content) as it is.

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

The API narrows to published or unpublished stories, and the CLI then tells `published` from
`changed` using the
[`unpublished_changes`](https://www.storyblok.com/docs/api/management/stories/the-story-object) flag
the listing already carries. It narrows a search **before any content is fetched**, which is the
cheapest kind of narrowing there is. The summary reports the stories it ruled out as
`skipped before fetch`.

### `--tag`

Stories carrying a [tag](https://www.storyblok.com/docs/guide/essentials/tags). Comma-separated, and
a story matches when it has **any** of the listed tags.

```bash
storyblok stories find --space 12345 --tag campaign          # one tag
storyblok stories find --space 12345 --tag campaign,legacy   # either tag
```

This is the opposite of `--includes-block`, where every listed block must be present. The two read
alike and mean different things, so it is worth stating out loud: `--tag a,b` is "a or b", while
`--includes-block a,b` is "a and b".

To match stories carrying **all** of several tags, chain a client-side check. `tag_list` rides on
the story listing, so the expression works under `--skip-content`:

```bash
storyblok stories find --space 12345 --tag campaign --skip-content \
  --where "$.tag_list[?(@ == 'legacy')]"
```

### `--workflow-stage`

Stories at a given [workflow](https://www.storyblok.com/docs/manuals/workflows) stage, by stage ID.
Comma-separated, matching **any** of them, and only the story's _active_ stage counts.

```bash
storyblok stories find --space 12345 --workflow-stage 42      # one stage
storyblok stories find --space 12345 --workflow-stage 42,43   # either stage
```

This is an API filter, so it narrows before anything is fetched. The per-language `stages` array on
the story is the client-side alternative, and it answers a different question: which language is at
which stage, rather than which stories are at a stage at all:

```bash
storyblok stories find --space 12345 \
  --where "$.stages[?(@.language == 'de' && @.workflow_stage_id == 42)]"
```

Prefer the flag where it fits: the `--where` form reads every story in the space to answer.

### `--sort`

Order the results. The API applies this, so it decides which stories are on the first page, which is
what makes it meaningful with [`--limit`](#--limit).

```bash
# Most recently updated first
storyblok stories find --space 12345 --sort updated_at:desc

# Oldest published first, then by slug
storyblok stories find --space 12345 --sort published_at:asc,slug:asc

# A content field, cast so it sorts as a number rather than as text
storyblok stories find --space 12345 --sort content.price:desc:float
```

The format is `field[:direction[:cast[:nulls]]]`, comma-separated for several:

| Part        | Values                                              |
| ----------- | --------------------------------------------------- |
| `direction` | `asc` (default), `desc`                             |
| `cast`      | `int`, `float`. Everything sorts as text otherwise. |
| `nulls`     | `nulls_first`, `nulls_last` (default)               |

Story fields are addressed by name (`updated_at`, `slug`, `name`), content fields with a `content.`
prefix (`content.price`). A column the space cannot sort by is rejected by the API, which is the
only place that knows the space's own schema.

`--sort` replaces the `jq -s 'sort_by(...)'` habit for anything the API can order by, and it is
strictly better in a pipe: `jq -s` has to buffer the whole result set before it can emit the first
line, while a sorted run streams.

### `--limit`

Stop once `n` results have been printed.

```bash
storyblok stories find --space 12345 --sort updated_at:desc --limit 10
```

The limit counts **results**, not stories examined, and it stops the run rather than trimming its
output: once the last line is out, the listing and every fetch still in flight are abandoned. On a
large space that is the difference between seconds and minutes.

`| head -n` does the same thing and is the better habit inside a pipe. `--limit` exists for the two
places `head` cannot go: a shell that does not have it (PowerShell), and the run's own summary,
which reports the stop as deliberate rather than leaving the counts looking like a scan that found
little. A limited run succeeds: it produced what it was asked for.

### `--references`

Find every story referencing a given story UUID. Resolved by the API, and it covers all reference
types: [reference fields](https://www.storyblok.com/docs/concepts/references), multilinks, and links
inside richtext. A story never counts as referencing itself.

Several UUIDs can be given at once, comma-separated, and they combine with **AND**: a story matches
only if it references _every_ one of them. That is the opposite of what a comma-separated list
usually suggests, and it fails quietly: adding one UUID nothing references takes the result set to
zero. Check against a single UUID first.

The value has to be a UUID. A story's own `full_slug` or name will not do, and is rejected rather
than quietly answered: the API reads an unparseable value as a raw substring search over story
content, which returns a plausible, slower, and entirely different result set.

```bash
# Everything pointing at one story
storyblok stories find --space 12345 --references "0c4f0f4a-9b5e-4c3a-8e7d-2f1a6b8c9d0e"

# Everything pointing at BOTH of two stories: the comma is AND
storyblok stories find --space 12345 \
  --references "0c4f0f4a-9b5e-4c3a-8e7d-2f1a6b8c9d0e,7a2b3c4d-1e2f-4a5b-9c8d-0e1f2a3b4c5d"

# Everything pointing at EITHER, by running one search per UUID
for uuid in 0c4f0f4a-9b5e-4c3a-8e7d-2f1a6b8c9d0e 7a2b3c4d-1e2f-4a5b-9c8d-0e1f2a3b4c5d; do
  storyblok stories find --space 12345 --references "$uuid" --skip-content
done | jq -sc 'unique_by(.uuid)[]'

# Combined with other filters
storyblok stories find --space 12345 --references "0c4f0f4a-9b5e-4c3a-8e7d-2f1a6b8c9d0e" \
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
count as the same. A reference can be both `unpublished` and `stale_url`, and is reported as both,
so that selecting one issue type never hides another.

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

This is the one mode that does not stream: an issue is only decidable once the whole scope has been
listed, because deciding one needs the _target's_ current slug and publish state. Matches are
buffered and written at the end. Everything else holds: same JSONL, and a reader that leaves still
ends the run cleanly. Only the first line arrives late.

### `--skip-content`, `--capi-filter`, `--capi-params`

The three optimization flags have a section of their own: see [Optimizations](#optimizations).

## Output

### One story per line on stdout

Each result is a complete
[story object](https://www.storyblok.com/docs/api/management/stories/the-story-object) as the
Management API returns it, printed as a single line of JSON. That format is JSONL: one
self-contained document per line, with no array to unwrap and no output format to choose.

```bash
storyblok stories find --space 12345 --container-block product > products.jsonl
```

Whatever flags produced a line, two things hold. Every line carries `id`, `uuid`, and `full_slug`:
`id` addresses the story for a write, `uuid` addresses it across spaces, and `full_slug` is what a
report about it has to say out loud. And `content` is on the line unless `--skip-content` was
passed, in which case the line is list metadata only.

### Pipe results into other commands

A pipe (`|`) hands one command's output to the next command's input, so `find` selects the stories
and something else turns them into the answer. Because every line is a whole JSON document,
line-oriented tools work on the output as it arrives. [`jq`](https://jqlang.org/) is the usual
partner: `-r` prints raw strings instead of quoted JSON, `-c` keeps one compact object per line.

```bash
# Slugs, one per line
storyblok stories find --space 12345 --container-block product | jq -r '.full_slug'

# How many matched
storyblok stories find --space 12345 --container-block product | wc -l

# Just the fields you need, saved as JSONL
storyblok stories find --space 12345 --container-block product \
  | jq -c '{id, name, component: .content.component}' > mystories.jsonl

# A JSON array instead, for something that wants one document
storyblok stories find --space 12345 --starts-with lp --skip-content | jq -s '.' > lp.json

# CSV for a spreadsheet
storyblok stories find --space 12345 --skip-content \
  | jq -r '[.id, .full_slug, .content_type, .published] | @csv' > inventory.csv

# Group and count with plain shell tools
storyblok stories find --space 12345 --skip-content \
  | jq -r '.content_type' | sort | uniq -c | sort -rn
```

**Results stream** as they match, so a reader can act on the first line without waiting for the
last, and memory stays flat on a result set of any size. Lines are written at the pace of whatever
reads them, and a reader that stops early stops the run: the command abandons the rest of the scope
rather than fetching output nobody will read.

### Annotations: keys starting with `_`

Some flags add their own keys to a line. Those keys always start with an underscore and are **not
part of the story**: `--check-references` adds `_ref_issues`, and other flags may add others later.
Filter and report on them freely, but strip them before sending a story back to the Management API.

Only **top-level** keys are annotations. The underscored keys inside `content`, such as `_uid` and
`_editable`, belong to the story itself and the API round-trips them, so they have to stay.

You can use pipes for that:

```bash
# Strip every annotation, leaving a plain story object. `with_entries` walks the top
# level only, so `_uid` and `_editable` inside `content` are left alone.
storyblok stories find --space 12345 --check-references \
  | jq -c 'with_entries(select(.key | startswith("_") | not))'
```

The same filter is worth keeping in any pipeline that writes, because it survives annotations that
did not exist when the script was written: drop unknown `_` keys rather than naming the ones to
remove.

## Common use cases

The questions teams actually ask a space, and the command that answers each one.

### Before deleting a story: what breaks?

Check references to see if a story is safe to delete. No content needed for this check, references
is a server side filter.

```bash
# Who links to this story?
storyblok stories find --space 12345 --references "99999999-2e88-44a7-9999-999992d31c12" \
  --skip-content | jq -r '.full_slug'
```

### Is this component safe to delete?

Before removing a block from the schema, find out where it is still used:

```bash
# Where is it used?
storyblok stories find --space 12345 --includes-block legacy_hero --skip-content | jq -r '.full_slug'

# Just the count, for a whole list of candidates
for block in legacy_hero old_teaser promo_banner; do
  echo "$block: $(storyblok stories find --space 12345 --includes-block "$block" --skip-content | wc -l)"
done
```

A component with no hits is a component you can drop.

### Accessibility audit: images with no alt text

The canonical content-quality query: every asset at any depth, across the whole space.

```bash
storyblok stories find --space 12345 --entry-type story --capi-filter --skip-content \
  --where "$..[?(@.fieldtype == 'asset' && @.filename != '' && @.alt == '')]" \
  | jq -r '.full_slug' > missing-alt.txt
```

The two optimization flags are what make this practical. Without them the same query reads every
story one at a time. See [Optimizations](#optimizations).

### A full link and reference audit

```bash
# Every reference problem in the space, as a repair list
storyblok stories find --space 12345 --check-references --capi-filter \
  | jq -c '{slug: .full_slug, issues: [._ref_issues[] | {type, field_path, cached_url, actual_url}]}' \
  > reference-issues.jsonl

# Only the outdated URLs, e.g. after a slug or folder restructure
storyblok stories find --space 12345 --check-references --capi-filter \
  --where "$._ref_issues[?(@.type == 'stale_url')]" | jq -r '.full_slug'

# Published pages pointing at something that is not live
storyblok stories find --space 12345 --check-references --publish-status published \
  --where "$._ref_issues[?(@.type == 'unpublished')]" | jq -r '.full_slug'
```

Add `--capi-filter` to audit a whole space: the check has to read every story's content, and the
flag is what makes reading all of it quick.

### What is waiting to go live?

```bash
# Published pages with unpublished edits sitting on them
storyblok stories find --space 12345 --publish-status changed --skip-content \
  --sort updated_at:desc | jq -r '[.full_slug, .updated_at] | @tsv'

# Drafts that never went live, oldest first
storyblok stories find --space 12345 --publish-status draft --skip-content \
  --sort created_at:asc | jq -r '.full_slug'

# Waiting on review, wherever the space's review stage is 42
storyblok stories find --space 12345 --workflow-stage 42 --skip-content | jq -r '.full_slug'
```

Publish state is on the listing, so all three answer from the page walk alone, without fetching a
single story's content.

### A content inventory, for a migration plan

```bash
# How many stories of each content type
storyblok stories find --space 12345 --skip-content | jq -r '.content_type' | sort | uniq -c | sort -rn

# The size of a subtree, before deciding how to process it
storyblok stories find --space 12345 --starts-with en/blog --skip-content | wc -l

# Every folder in the space
storyblok stories find --space 12345 --entry-type folder --skip-content | jq -r '.full_slug'

# A quick look at what a filter matches, without walking the whole space
storyblok stories find --space 12345 --container-block product --skip-content --limit 5
```

### Translation coverage

Storyblok's [internationalization](https://www.storyblok.com/docs/concepts/internationalization)
setups each expose translation state differently, and `--where` reaches all of them.

**Field-level translations** store translated values as
[`<field>__i18n__<lang>` keys](https://www.storyblok.com/docs/api/management/stories/internationalization-for-stories)
inside `content`. The CDN drops those keys, so these need the Management API, with no
`--capi-filter`:

```bash
# German title missing or empty
storyblok stories find --space 12345 \
  --where "$[?(!$.content.title__i18n__de || $.content.title__i18n__de == '')]"

# Any field missing its German version, at any depth
storyblok stories find --space 12345 --container-block product \
  --where "$..[?(@.description__i18n__de == '')]"
```

**Folder-level translations** put each language under its own path, so `--starts-with` scopes a
search to one language:

```bash
# German stories still in draft
storyblok stories find --space 12345 --starts-with "de/" --publish-status draft --skip-content

# Compare coverage between two languages
for lang in en de fr; do
  echo "$lang: $(storyblok stories find --space 12345 --starts-with "$lang/" \
    --publish-status published --skip-content | wc -l)"
done
```

**Individual translation publishing**, once
[enabled for the space](https://www.storyblok.com/docs/concepts/internationalization), adds a
`translated_stories` array with one entry per language. Unlike `stages`, it is only on the
single-story response, so these need the content fetch: `--skip-content` would leave nothing to
match:

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
```

**Per-language [workflow](https://www.storyblok.com/docs/manuals/workflows) stages** appear in a
`stages` array, one entry per language, each carrying a `workflow_stage_id`:

```bash
# Any language at that stage: the API filter answers this without reading content
storyblok stories find --space 12345 --workflow-stage 42

# German specifically, which the API filter cannot express
storyblok stories find --space 12345 --skip-content \
  --where "$.stages[?(@.language == 'de' && @.workflow_stage_id == 42)]"
```

### Drive other commands

```bash
# Check what a filter matches before acting on it
storyblok stories find --space 12345 --query="[archived][is]=true" --skip-content | wc -l

# Hand the ids to another command
storyblok stories find --space 12345 --query="[archived][is]=true" --skip-content \
  | jq -r '.id' | xargs -I{} storyblok stories delete --space 12345 {}

# Keep a search's matches for later processing
storyblok stories find --space 12345 --container-block product > products.jsonl
```

## Optimizations

Almost all of it goes into fetching the story content. The Management API's
[story listing](https://www.storyblok.com/docs/api/management/stories/retrieve-multiple-stories)
does not include content, so every story needs an individual request of its own.

A run over 191 stories with three `--where` expressions over a subtree divides up like this:

| Stage                | Work            | Time      |
| -------------------- | --------------- | --------- |
| Listing stories      | 1 request       | 0.6s      |
| Fetching content     | 191 requests    | **31.6s** |
| Evaluating `--where` | 352 evaluations | 0.8s      |

### The two flags, and the pipelines they produce

Two flags change how a run reads content:

- **`--skip-content`** does not fetch story content at all, so the output is list metadata.
- **`--capi-filter`** reads content from the Content Delivery API in bulk, instead of one story at a
  time through the Management API.

They are independent, so a run takes one of four shapes. Which one it takes decides both what a
query can ask and what it costs.

```
no flags
┌───────────┐   ┌───────────────────┐   ┌─────────┐
│ MAPI LIST │ → │ MAPI 1-BY-1 FETCH │ → │ --where │
└───────────┘   └───────────────────┘   └─────────┘

--skip-content
┌───────────┐                           ┌─────────┐
│ MAPI LIST │ ────────────────────────→ │ --where │
└───────────┘                           └─────────┘

--capi-filter
┌───────────┐   ┌───────────────────┐   ┌─────────┐   ┌───────────────────┐
│ MAPI LIST │ → │    CAPI FETCH     │ → │ --where │ → │ MAPI 1-BY-1 FETCH │
└───────────┘   └───────────────────┘   └─────────┘   └───────────────────┘

--capi-filter --skip-content
┌───────────┐   ┌───────────────────┐   ┌─────────┐
│ MAPI LIST │ → │    CAPI FETCH     │ → │ --where │
└───────────┘   └───────────────────┘   └─────────┘
```

Only `--capi-filter` runs a second Management API stage, and only for the stories that matched: the
bulk CAPI read decides `--where`, then the matches are re-read one by one so the output carries
Management API content.

| Combination                    | `--where` can read content | Output has `content` |
| ------------------------------ | -------------------------- | -------------------- |
| no flags                       | ✅ yes                     | ✅ yes               |
| `--skip-content`               | ❌ **no**                  | ❌ no                |
| `--capi-filter`                | ✅ yes                     | ✅ yes               |
| `--capi-filter --skip-content` | ✅ **yes**                 | ❌ no                |

> **The row that surprises people is the last one.** `--capi-filter --skip-content` lets `--where`
> filter **on story content that is not in the output**. `--skip-content` on its own cannot: with no
> content read anywhere, a content expression matches nothing. Adding `--capi-filter` gives the
> filter a bulk source of content to decide against, while the output stays list metadata. You get
> to ask a content question and still pay nothing per story.

The same question four times over the same subtree: which stories hold a `customers_logos` block
with eight or more logos. Three of the four return the same stories.

```bash
# No flags: every story in scope fetched one by one. 35.5s, 42 matched
storyblok stories find --space 12345 --starts-with lp \
  --where "$..[?(@.component == 'customers_logos' && count(@.logos_list[*]) >= 8)]"

# --capi-filter: content read in bulk, only the matches cost a fetch. 8.6s, 42 matched
storyblok stories find --space 12345 --starts-with lp --capi-filter \
  --where "$..[?(@.component == 'customers_logos' && count(@.logos_list[*]) >= 8)]"

# --capi-filter --skip-content: nothing fetched per story at all. 1.6s, 42 matched
storyblok stories find --space 12345 --starts-with lp --capi-filter --skip-content \
  --where "$..[?(@.component == 'customers_logos' && count(@.logos_list[*]) >= 8)]"

# --skip-content alone cannot answer this. 0.5s, 0 matched, and the 0 is wrong:
# storyblok stories find --space 12345 --starts-with lp --skip-content \
#   --where "$..[?(@.component == 'customers_logos' && count(@.logos_list[*]) >= 8)]"
```

That last one is not a slower way to get the answer; it is a fast way to get the wrong one. It is
the one shape of the four that cannot answer a content question, and the command says so on stderr
when it happens.

### `--skip-content`

If nothing in the query needs content, do not fetch it. The content phase disappears and the run
becomes the page walk, which moves stories in bulk rather than one at a time.

The output is the story listing:
[the story object](https://www.storyblok.com/docs/api/management/stories/the-story-object) as the
listing returns it, with slugs, ids, publish state and timestamps, but **no `content` field**. The
run also asks for the `content_summary` digest, which the listing omits by default and which is
often enough on its own to tell two stories apart.

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
property except `content`, so a filter on `full_slug`, `updated_at`, `content_type`, `tag_list`,
`published` or `stages` needs nothing that was skipped:

```bash
# Every landing page whose slug mentions a partner, in one page walk
storyblok stories find --space 12345 --starts-with lp --skip-content \
  --where "$[?search($.full_slug, 'accelerators')]"

# The content type is on the listing too, so this needs no content
storyblok stories find --space 12345 --skip-content --where "$[?($.content_type == 'product')]"
```

An expression that _does_ read content matches nothing, since the content is not there to read. The
command warns on stderr when that leaves the run with no results at all.

Adding [`--capi-filter`](#--capi-filter) gives those expressions a source of content again, without
bringing the per-story fetch back. See
[`--capi-filter` with `--skip-content`](#--capi-filter-with---skip-content).

Good to know:

- **`--check-references` is refused**, since references live in the content it skips, leaving the
  check nothing to read.
- **API filters are unaffected:** free-text search, `--query`, `--container-block`,
  `--includes-block`, `--starts-with`, `--entry-type`, `--tag`, `--workflow-stage` and
  `--references` all still work.
- **`--publish-status` still works**, since it is decided from the listing.
- **Existing pipes may need a look.** `jq '.content.component'` yields `null` per line rather than
  failing, so a script that used to read content will not complain about the change.

### `--capi-filter`

The Content Delivery API returns content in bulk, far faster than reading stories one at a time
through the Management API:

| Content source                      | Read rate                                     |
| ----------------------------------- | --------------------------------------------- |
| Management API, one story at a time | max 6 stories per second (`--api-rate-limit`) |
| Content Delivery API, in bulk       | up to 1,250 stories per second                |

`--where` is evaluated against that bulk payload, so the only stories that still need an individual
Management API request are the ones that matched. Without the flag a run costs one request per story
**in scope**; with it, one request per **match**, plus a bulk read fast enough to ignore.

So the gain is the **selectivity** of the query: how much of the scope it throws away.

| Scope         | Matched | Without the flag | With `--capi-filter` | Speedup |
| ------------- | ------: | ---------------- | -------------------- | ------- |
| 500 stories   |      50 | 84s              | **10s**              | 8×      |
| 3,951 stories |     100 | 659s (11min)     | **27s**              | 24×     |
| 3,951 stories |   1,000 | 659s             | 177s                 | 3.7×    |
| 3,951 stories |   3,900 | 659s             | 661s                 | none    |

A selective filter turns minutes into seconds. A filter that keeps almost everything gains nothing,
and pays for a bulk read it could not act on, so the worst case is roughly the un-flagged run rather
than something worse.

**The bulk pass is where `--where` is decided.** A story it matches is a match, and the filters are
not evaluated a second time once the full story arrives. A story it decides against is never fetched
at all. Only stories it _cannot_ decide are filtered later: folders, stories the CDN holds no
content for, and any story in a request that failed. Those are fetched and tested as usual, so
nothing reaches stdout untested.

```bash
# Same question as without the flag, a fraction of the requests
storyblok stories find --space 12345 --starts-with lp --capi-filter \
  --where "$..[?(@.component == 'customers_logos' && count(@.logos_list[*]) >= 8)]"

# Composes with the other filters as usual
storyblok stories find --space 12345 --publish-status published --includes-block hero \
  --capi-filter --where "$..[?(@.component == 'hero' && @.headline == '')]"
```

The summary reports what it saved, as stories pruned before the fetch:

```
Filtering via CAPI: 21/191 candidates, 170 pruned before fetch, 0 undecided, 0 batch(es) failed.
Fetching content: 21/21 succeeded, 0 failed.
```

`--capi-filter` needs at least one `--where` expression to have anything to prune. Without one,
every listed story is a match, except under `--check-references`, where it plays a different role.

#### `--capi-filter` with `--skip-content`

The fastest shape a content filter has: the CDN decides every match in bulk, and **no story is
fetched from MAPI at all**. Reach for it when the question is "which stories" rather than "what is
in them", and the answer feeds ids or slugs into something else.

```bash
# Ids of every story using a customers_logos with eight or more logos
storyblok stories find --space 12345 --starts-with lp --capi-filter --skip-content \
  --where "$..[?(@.component == 'customers_logos' && count(@.logos_list[*]) >= 8)]" \
  | jq -r '.id'
```

This is the combination that lets you **filter on story content without putting content in the
output**: `--capi-filter` gives `--where` a bulk source of content to decide against, and
`--skip-content` keeps the lines themselves list metadata.

### `--capi-params`

Extra query parameters when using `--capi-filter`, so anything
[the CDN's story endpoint](https://www.storyblok.com/docs/api/content-delivery/v2/stories/retrieve-multiple-stories)
accepts can be applied to them.

Three equivalent forms are accepted:

```bash
--capi-params '{"version":"published","language":"de"}'   # JSON
--capi-params '{version: published, language: de}'        # JSON without the quoting
--capi-params 'version=published,language=de'             # plain pairs (& also separates)
```

Two rules the command enforces:

- **`version=published` requires `--publish-status published` or `changed`.** A story with no
  published version cannot be decided from published CDN content, so it has to be out of scope
  first.
- **`by_uuids`, `by_uuids_ordered`, `per_page` and `page` are rejected**, since the command manages
  batching itself.

```bash
# What is actually live, including pages with pending edits
storyblok stories find --space 12345 --capi-filter --skip-content \
  --publish-status changed --capi-params "version=published" \
  --where "$..[?(@.component == 'hero' && @.headline == '')]"
```

## Best practices

### Narrow on the server first, always

Every API filter is free: it reduces what is transferred and costs nothing locally. Every
client-side filter costs a request per story in scope. So push as much of the question as possible
into `--starts-with`, `--entry-type`, `--container-block`, `--includes-block`, `--query`, `--tag`,
`--workflow-stage` and `--publish-status`, and leave `--where` only the part nothing else can
express.

```bash title="Don't: every story in the space is fetched one at a time"
storyblok stories find --space 12345 \
  --where "$..[?(@.component == 'hero' && @.headline == '')]"
```

```bash title="Do: the API hands over only the stories that contain a hero"
storyblok stories find --space 12345 --includes-block hero \
  --where "$..[?(@.component == 'hero' && @.headline == '')]"
```

`--includes-block` and `--container-block` are the two that most often turn a space-wide scan into a
subtree-sized one.

### Size the scope before you run the query

`--skip-content | wc -l` answers "how many stories will this touch" in seconds. Run it with the
**server-side filters only**, and drop every `--where`: the scope is what the API hands over before
any client-side filtering, and a `--where` that reads content matches nothing under `--skip-content`
anyway.

```bash
# The real query
storyblok stories find --space 12345 --includes-block hero \
  --where "$..[?(@.component == 'hero' && @.headline == '')]"

# Its scope: the same server-side filters, no --where
storyblok stories find --space 12345 --includes-block hero --skip-content | wc -l
```

Divide that count by the Management API rate limit for the seconds an un-flagged run will take. If
the answer is minutes, think if you can optimize by [`--capi-filter`](#--capi-filter).

### Pick the optimization combination you need

1. Does the query read story content? If **no** → `--skip-content`.
2. If **yes**, do you need `content` in the output?
   - **No** → `--capi-filter --skip-content`. Fastest possible.
   - **Yes** → `--capi-filter`. One MAPI request per match instead of per story in scope.
3. Does the query need something the CDN does not serve? Then neither flag fits and every story has
   to be read from the Management API: field-level translations (`<field>__i18n__<lang>` keys),
   per-language publish and workflow state, and anything else that lives only in the Management API
   story payload. See
   [CDN content is not Management API content](#cdn-content-is-not-management-api-content).

### Develop the query with `--limit`, then drop it

A JSONPath expression is easy to get subtly wrong, and finding out after a full-space scan is the
expensive way to learn. `--limit 5` (or `| head -5`) gives the first results in seconds:

```bash
storyblok stories find --space 12345 --includes-block hero --capi-filter --limit 5 \
  --where "$..[?(@.component == 'hero' && @.headline == '')]" | jq -r '.full_slug'
```

The run stops as soon as it has them, so iterating on an expression costs seconds regardless of the
size of the space.

### Keep destructive selections in a file

`find` is read-only, so the left-hand side of a pipe is always safe. The right-hand side may not be.
Write the selection down first, read it, and act on the file.

```bash title="Don't: nothing to review, and nothing to re-apply or audit afterwards"
storyblok stories find --space 12345 --starts-with en/campaigns/2023 --skip-content \
  | jq -r '.id' | xargs -I{} storyblok stories delete --space 12345 {}
```

```bash title="Do: write the selection down, read it, then act on the file"
storyblok stories find --space 12345 --starts-with en/campaigns/2023 --skip-content \
  > selection.jsonl
wc -l selection.jsonl
jq -r '.full_slug' selection.jsonl | less
# only then
jq -r '.id' selection.jsonl | xargs -I{} storyblok stories delete --space 12345 {}
```

That keeps the set re-appliable, auditable and diffable, and it closes the window in which a story
can move between the read and the write.

### `--entry-type story` under `--capi-filter`

The CDN holds no content for folders, so every folder in scope passes through the bulk stage
undecided and costs an individual MAPI request anyway. Excluding them usually removes the "could not
be decided" warning as well.

### Prefer `--sort` over sorting the output

`jq -s 'sort_by(...)'` has to buffer the whole result set before it can emit the first line, which
throws away the streaming. `--sort` is applied by the API, so it decides which stories are on the
first page, which is also what makes `--limit` mean "the top n" rather than "any n".

```bash title="Don't: the whole result set is buffered before the first line appears"
storyblok stories find --space 12345 --starts-with en/blog \
  | jq -s 'sort_by(.updated_at) | reverse | .[0:10]'
```

```bash title="Do: the API sorts, and the run stops after ten stories"
storyblok stories find --space 12345 --starts-with en/blog --sort updated_at:desc --limit 10
```

## Caveats

### CDN content is not Management API content

Three differences, all of which can change what a `--where` expression matches:

- **Field-level translations are absent.** The CDN drops every `<field>__i18n__<lang>` key. That is
  harmless for an expression over untranslated fields, and a silent undercount when a **bloks**
  field is field-level translated: those nested blocks are simply not in the document the filter
  sees. This is why `--check-references --capi-filter` warns before it starts.
- **Draft content carries `_editable`**, the marker the Visual Editor uses. It never reaches the
  output, but a `--where` expression mentioning `_editable` matches with the flag and not without
  it.
- **Folders have no content at all**, so they can never be pruned.

It serves things the raw Management API payload does not, though, and `--where` filters on those as
usual: `--capi-params "version=published"` decides against the published snapshot rather than the
draft, and `--capi-params "language=de"` decides against a language-resolved document in
[folder-level](https://www.storyblok.com/docs/concepts/internationalization) setups.

### A comma does not always mean "or"

Four flags take a comma-separated list, and they do not agree on what the comma means. Each one maps
straight onto a
[Management API story listing parameter](https://www.storyblok.com/docs/api/management/stories/retrieve-multiple-stories),
so the semantics are the API's rather than the CLI's:

| Flag                   | API parameter        | `a,b` matches               |
| ---------------------- | -------------------- | --------------------------- |
| `--includes-block a,b` | `contain_component`  | contains **both** blocks    |
| `--references a,b`     | `reference_search`   | references **both** stories |
| `--tag a,b`            | `with_tag`           | carries **either** tag      |
| `--workflow-stage a,b` | `in_workflow_stages` | at **either** stage         |

The two AND flags are the ones that surprise: adding a value nothing matches takes the result set to
zero rather than widening it. For "any of these blocks" or "any of these references", run once per
value and concatenate; for "all of these tags", chain a `--where` over `tag_list`.
