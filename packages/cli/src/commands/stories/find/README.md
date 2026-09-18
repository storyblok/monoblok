---
title: "storyblok stories find"
description:
  "Search a Storyblok space for stories matching a set of filters and print them as JSONL, one story
  per line."
---

import { Aside, Badge, LinkCard } from "@astrojs/starlight/components";

The `stories find` command searches a space for stories matching a set of filters and prints them to
stdout as JSONL, one story per line, ready to pipe into `jq`, save to a file, or pass to another
command. It only reads, and never writes.

_Introduced in_ <Badge text="4.23.0" variant="success" />

```bash
storyblok stories find "pricing" --space 12345 --publish-status published
```

Filters combine with AND. The API resolves some of them, and the CLI resolves others locally once a
story's content has been read. Which is which determines what a run costs, and is what the
[optimization flags](#optimizations) address.

## Prerequisites

- An authenticated session. Run `storyblok login` first.
- Access to the space being searched.

## Usage

```bash
storyblok stories find [text] --space <space> [options]
```

## Arguments

| Name     | Description                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| `[text]` | Optional. A free-text search across the space's stories. Always case-insensitive, and resolved by the API. |

## Flags

The `Runs` column states where a filter is resolved. `API` filters narrow the search before anything
is transferred. `client` filters are applied locally, and most of them require the story's content,
which costs one request per story. See [Optimizations](#optimizations).

| Flag                        | Runs         | Description                                                                                                                                           |
| --------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-s, --space <space>`       | -            | **Required.** The space to search. Can also come from the environment or the config file.                                                             |
| `--entry-type <type>`       | API          | Narrow to stories or folders only. Possible values: `all` (default), `story`, `folder`.                                                               |
| `--starts-with <path>`      | API          | Limit the search to one subtree, for example `en/blog`. No leading slash.                                                                             |
| `--container-block <name>`  | API          | Stories whose content type (root block) is this component. See [`--container-block` and `--includes-block`](#--container-block-and---includes-block). |
| `--includes-block <names>`  | API          | Stories containing these blocks at any depth. Comma-separated, and **all** must be present.                                                           |
| `-q, --query <query>`       | API          | Filter on root-level content fields. See [`--query`](#--query).                                                                                       |
| `--tag <names>`             | API          | Stories carrying **any** of these tags. Comma-separated. See [`--tag`](#--tag).                                                                       |
| `--workflow-stage <ids>`    | API          | Stories at **any** of these workflow stage IDs. Comma-separated. See [`--workflow-stage`](#--workflow-stage).                                         |
| `--publish-status <status>` | API + client | Publish state, decided from the story listing. Possible values: `published`, `changed`, `draft`. See [`--publish-status`](#--publish-status).         |
| `--where <jsonpath>`        | client       | Anything `--query` cannot express. Repeatable, and expressions combine with AND. See [`--where`](#--where).                                           |
| `--references <uuids>`      | API          | Stories whose content references **all** of these story UUIDs. Comma-separated. See [`--references`](#--references).                                  |
| `--check-references`        | client       | Report broken references, unpublished targets, and outdated link URLs. See [`--check-references`](#--check-references).                               |
| `--sort <fields>`           | API          | Order results server-side, for example `updated_at:desc`. See [`--sort`](#--sort).                                                                    |
| `--limit <n>`               | -            | A positive integer. Stop once this many results are printed, leaving the rest of the scope unread. See [`--limit`](#--limit).                         |
| `--skip-content`            | -            | Do not fetch story content, and emit list metadata only. See [`--skip-content`](#--skip-content).                                                     |
| `--capi-filter`             | -            | Evaluate `--where` against bulk Content Delivery API content, and fetch only the matches. See [`--capi-filter`](#--capi-filter).                      |
| `--capi-params <params>`    | -            | Extra Content Delivery API query parameters for `--capi-filter`. See [`--capi-params`](#--capi-params).                                               |

The global flags apply as usual. Three of them matter here: `--space`, `--verbose`, and
`--api-rate-limit`, which paces Management API requests at six requests per second by default.
`--path` moves the run report and log, and `--no-ui-enabled` silences every non-result line while
leaving stdout untouched.

<Aside type="caution">
Four flags take a comma-separated list, and they do not agree on what the comma means. Each one maps onto a [Management API story listing parameter](/docs/api/management/stories/retrieve-multiple-stories), so the semantics are the API's rather than the CLI's.

| Flag                   | API parameter        | `a,b` matches               |
| ---------------------- | -------------------- | --------------------------- |
| `--includes-block a,b` | `contain_component`  | contains **both** blocks    |
| `--references a,b`     | `reference_search`   | references **both** stories |
| `--tag a,b`            | `with_tag`           | carries **either** tag      |
| `--workflow-stage a,b` | `in_workflow_stages` | at **either** stage         |

The two AND flags are the ones to watch: adding a value that nothing matches takes the result set to
zero rather than widening it. To match any of several blocks or references, run the command once per
value and concatenate the output. To match all of several tags, chain a `--where` expression over
`tag_list`.
</Aside>

### `--entry-type`

```bash
storyblok stories find --space 12345                       # stories and folders (default)
storyblok stories find --space 12345 --entry-type story    # stories only
storyblok stories find --space 12345 --entry-type folder   # folders only
```

Pass `--entry-type story` under `--capi-filter`. The Content Delivery API holds no content for a
folder, so folders are the one thing that stage can never prune.

### `--starts-with`

```bash
storyblok stories find --space 12345 --starts-with "en/blog"
```

### `--container-block` and `--includes-block`

`--container-block` matches a story's content type. `--includes-block` matches a nestable block used
anywhere inside it. See [Blocks](/docs/concepts/blocks) for the difference. The API resolves both.

Several names in `--includes-block` combine with AND, so the story has to contain every one of them.
To find stories using any one of a set, run the command once per block and concatenate the output.

```bash
# Stories whose content type is "product"
storyblok stories find --space 12345 --container-block product

# Stories using both a hero and a pricing table anywhere in their content
storyblok stories find --space 12345 --includes-block hero,pricing_table
```

### `--query`

Filters on root-level content fields, using Storyblok's filter query syntax
(`[field][operation]=value`). The API resolves it, so
[filter query operations](/docs/api/content-delivery/v2/filter-queries/operations) documents which
operators exist and what each one matches.

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

Field and operator names are passed to the API as written, so the API decides whether a query is
valid. `--container-block product` is shorthand for `--query="[component][in]=product"`, and the two
combine into a single query field by field, so clauses on other fields survive. Setting the same
field and operator from both flags is a usage error rather than a silent last-one-wins. Input that
parses to nothing is rejected as well, because a `--query` with no readable clause would send no
filter at all and return the whole space.

### `--where`

Covers everything `--query` cannot express: nested blocks, any-depth search, regular expressions,
`>=` and `<=` comparisons, and story-level properties. Expressions are based on
[JSONPath (RFC 9535)](https://datatracker.ietf.org/doc/html/rfc9535).

A story matches when the expression selects at least one node. Two rules cover almost every
expression:

- **`@` is the node being tested.** A filter selects among a node's children, so
  `$..[?(@.component == 'hero')]` tests every block inside the story, and `$.stages[?(…)]` tests
  each entry of the `stages` array.
- **Use `$` for story-level properties.** `$[?($.updated_at > '2025-01-01')]` tests the story
  itself. `$[?(@.updated_at > …)]` instead asks whether any property value of the story has an
  `updated_at`, and never matches.

Walking a story means meeting strings, numbers, and `null` alongside blocks. Reading a property off
one of those is a non-match rather than an error, so `$..[?(@.fieldtype == 'asset')]` is safe to run
over any content.

Function extensions are available: `match()` and `search()` for regular expressions, plus
`length()`, `count()`, and `value()`. Expressions are parsed, never evaluated as JavaScript, so
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

Most expressions reach into `content`, which the story listing does not carry. That is the per-story
request the [optimization flags](#optimizations) exist to avoid. An expression written against story
metadata (`full_slug`, `updated_at`, `content_type`, `tag_list`, `published`) is answerable from the
listing alone, and works under [`--skip-content`](#--skip-content) as it is.

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

The API narrows to published or unpublished stories, and the CLI then distinguishes `published` from
`changed` using the [`unpublished_changes`](/docs/api/management/stories/the-story-object) flag that
the listing already carries. This filter narrows a search before any content is fetched, which is
the cheapest kind of narrowing available. The run summary reports the stories it ruled out as
`skipped before fetch`.

### `--tag`

Matches stories carrying a [tag](/docs/guide/essentials/tags). Comma-separated, and a story matches
when it has any of the listed tags.

```bash
storyblok stories find --space 12345 --tag campaign          # one tag
storyblok stories find --space 12345 --tag campaign,legacy   # either tag
```

To match stories carrying all of several tags, chain a client-side check. `tag_list` is on the story
listing, so the expression works under `--skip-content`:

```bash
storyblok stories find --space 12345 --tag campaign --skip-content \
  --where "$.tag_list[?(@ == 'legacy')]"
```

### `--workflow-stage`

Matches stories at a given [workflow](/docs/manuals/workflows) stage, by stage ID. Comma-separated,
matching any of them, and only the story's active stage counts.

```bash
storyblok stories find --space 12345 --workflow-stage 42      # one stage
storyblok stories find --space 12345 --workflow-stage 42,43   # either stage
```

This is an API filter, so it narrows before anything is fetched. The per-language `stages` array on
the story is the client-side alternative, and it answers a different question: which language is at
which stage, rather than which stories are at a stage at all.

```bash
storyblok stories find --space 12345 \
  --where "$.stages[?(@.language == 'de' && @.workflow_stage_id == 42)]"
```

Use the flag where it fits. The `--where` form reads every story in the space to answer.

### `--sort`

Orders the results. The API applies this, so it decides which stories are on the first page, which
is what makes it meaningful with [`--limit`](#--limit).

```bash
# Most recently updated first
storyblok stories find --space 12345 --sort updated_at:desc

# Oldest published first, then by slug
storyblok stories find --space 12345 --sort published_at:asc,slug:asc

# A content field, cast so it sorts as a number rather than as text
storyblok stories find --space 12345 --sort content.price:desc:float
```

The format is `field[:direction[:cast[:nulls]]]`, comma-separated for several fields:

| Part        | Description                                           |
| ----------- | ----------------------------------------------------- |
| `direction` | `asc` (default) or `desc`.                            |
| `cast`      | `int` or `float`. Everything sorts as text otherwise. |
| `nulls`     | `nulls_first` or `nulls_last` (default).              |

Story fields are addressed by name (`updated_at`, `slug`, `name`), and content fields with a
`content.` prefix (`content.price`). A column the space cannot sort by is rejected by the API, which
is the only place that knows the space's own schema.

### `--limit`

Stops the run once this many results have been printed.

```bash
storyblok stories find --space 12345 --sort updated_at:desc --limit 10
```

The limit counts results, not stories examined, and it stops the run rather than trimming its
output. Once the last line is out, the listing and every fetch still in flight are abandoned. On a
large space that is the difference between seconds and minutes.

`| head -n` does the same thing and is the better habit inside a pipe. `--limit` covers the two
places `head` cannot go: a shell that does not have it, such as PowerShell, and the run summary,
which reports the stop as deliberate rather than leaving the counts looking like a scan that found
little. A limited run succeeds, because it produced what it was asked for.

### `--references`

Finds every story referencing a given story UUID. The API resolves it, and it covers all reference
types: [reference fields](/docs/concepts/references), multilinks, and links inside richtext. A story
never counts as referencing itself.

Several UUIDs can be given at once, comma-separated, and they combine with AND, so a story matches
only if it references every one of them.

<Aside type="caution">
The value has to be a UUID. A story's `full_slug` or name is rejected rather than quietly answered, because the API reads an unparseable value as a raw substring search over story content, which returns a plausible, slower, and entirely different result set.
</Aside>

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
fields hold bare UUIDs, so the space's components are loaded first to determine which fields are
references. Field-level translations of those fields (`author__i18n__de`) are checked as well, and
targets outside the search scope are looked up as needed.

Each problem falls into one of three types:

| Type          | Description                                                                      |
| ------------- | -------------------------------------------------------------------------------- |
| `broken`      | The target UUID does not exist in the space.                                     |
| `unpublished` | The target exists but is not published. Folders are exempt, being unpublishable. |
| `stale_url`   | A link field's cached URL no longer matches the target's current path.           |

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

`ref_type` is `multilink`, `richtext`, or `relation`. `actual_url` appears only when the target was
found, and `cached_url` only for reference types that carry one, so a relation problem has neither.

`--where` is applied after this enrichment, which is what lets it filter on `_ref_issues`:

```bash
# Audit a whole space
storyblok stories find --space 12345 --check-references

# The same audit, reading content from the CDN in bulk instead of story by story
storyblok stories find --space 12345 --check-references --capi-filter

# Only dead links
storyblok stories find --space 12345 --check-references \
  --where "$._ref_issues[?(@.type == 'broken')]"

# Only outdated URLs, for example after a restructure
storyblok stories find --space 12345 --check-references \
  --where "$._ref_issues[?(@.type == 'stale_url')]"

# Published stories pointing at unpublished targets
storyblok stories find --space 12345 --check-references --publish-status published \
  --where "$._ref_issues[?(@.type == 'unpublished')]"
```

<Aside type="note">
This is the one mode that does not stream. An issue is only decidable once the whole scope has been listed, because deciding one needs the target's current slug and publish state, so matches are buffered and written at the end. Everything else holds: the same JSONL, and a reader that leaves still ends the run cleanly. Only the first line arrives late.
</Aside>

## Output

Each result is a complete [story object](/docs/api/management/stories/the-story-object) as the
Management API returns it, printed as a single line of JSON. That format is JSONL: one
self-contained document per line, with no array to unwrap and no output format to choose.

```bash
storyblok stories find --space 12345 --container-block product > products.jsonl
```

Whatever flags produced a line, two things hold. Every line carries `id`, `uuid`, and `full_slug`,
where `id` addresses the story for a write, `uuid` addresses it across spaces, and `full_slug`
identifies it in a report. And `content` is on the line unless `--skip-content` was passed, in which
case the line is list metadata only.

### Pipe results into other commands

A pipe (`|`) passes one command's output to the next command's input, so `find` selects the stories
and another command turns them into the answer. Because every line is a complete JSON document,
line-oriented tools work on the output as it arrives. [`jq`](https://jqlang.org/) is the usual
partner, where `-r` prints raw strings instead of quoted JSON and `-c` keeps one compact object per
line.

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

Results stream as they match, so a reader can act on the first line without waiting for the last,
and memory stays flat on a result set of any size. Lines are written at the pace of whatever reads
them, and a reader that stops early stops the run, so the command abandons the rest of the scope
rather than fetching output nobody will read.

### Annotations

Some flags add their own keys to a line. Those keys always start with an underscore and are not part
of the story: `--check-references` adds `_ref_issues`, and other flags may add more later. Filter
and report on them as needed, but strip them before sending a story back to the Management API.

Only top-level keys are annotations. The underscored keys inside `content`, such as `_uid` and
`_editable`, belong to the story itself and the API round-trips them, so they have to stay.

```bash
# Strip every annotation, leaving a plain story object. `with_entries` walks the top
# level only, so `_uid` and `_editable` inside `content` are left alone.
storyblok stories find --space 12345 --check-references \
  | jq -c 'with_entries(select(.key | startswith("_") | not))'
```

Keep this filter in any pipeline that writes, because it survives annotations that did not exist
when the script was written: it drops unknown `_` keys rather than naming the ones to remove.

## Examples

### Check what breaks before deleting a story

Check references to determine whether a story is safe to delete. This check needs no content,
because `--references` is a server-side filter.

```bash
# Who links to this story?
storyblok stories find --space 12345 --references "99999999-2e88-44a7-9999-999992d31c12" \
  --skip-content | jq -r '.full_slug'
```

### Check whether a component is safe to delete

Before removing a block from the schema, find out where it is still used.

```bash
# Where is it used?
storyblok stories find --space 12345 --includes-block legacy_hero --skip-content | jq -r '.full_slug'

# Just the count, for a whole list of candidates
for block in legacy_hero old_teaser promo_banner; do
  echo "$block: $(storyblok stories find --space 12345 --includes-block "$block" --skip-content | wc -l)"
done
```

A component with no hits can be dropped.

### Audit images with no alt text

This query covers every asset at any depth, across the whole space.

```bash
storyblok stories find --space 12345 --entry-type story --capi-filter --skip-content \
  --where "$..[?(@.fieldtype == 'asset' && @.filename != '' && @.alt == '')]" \
  | jq -r '.full_slug' > missing-alt.txt
```

The two optimization flags are what make this practical. Without them, the same query reads every
story one at a time. See [Optimizations](#optimizations).

### Audit links and references

```bash
# Every reference problem in the space, as a repair list
storyblok stories find --space 12345 --check-references --capi-filter \
  | jq -c '{slug: .full_slug, issues: [._ref_issues[] | {type, field_path, cached_url, actual_url}]}' \
  > reference-issues.jsonl

# Only the outdated URLs, for example after a slug or folder restructure
storyblok stories find --space 12345 --check-references --capi-filter \
  --where "$._ref_issues[?(@.type == 'stale_url')]" | jq -r '.full_slug'

# Published pages pointing at something that is not live
storyblok stories find --space 12345 --check-references --publish-status published \
  --where "$._ref_issues[?(@.type == 'unpublished')]" | jq -r '.full_slug'
```

Add `--capi-filter` to audit a whole space. The check has to read every story's content, and the
flag is what makes reading all of it quick.

### Find what is waiting to go live

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

### Build a content inventory

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

### Check translation coverage

Storyblok's [internationalization](/docs/concepts/internationalization) setups each expose
translation state differently, and `--where` reaches all of them.

**Field-level translations** store translated values as
[`<field>__i18n__<lang>` keys](/docs/api/management/stories/internationalization-for-stories) inside
`content`. The Content Delivery API drops those keys, so these queries need the Management API and
cannot use `--capi-filter`.

```bash
# German title missing or empty
storyblok stories find --space 12345 \
  --where "$[?(!$.content.title__i18n__de || $.content.title__i18n__de == '')]"

# Any field missing its German version, at any depth
storyblok stories find --space 12345 --container-block product \
  --where "$..[?(@.description__i18n__de == '')]"
```

**Folder-level translations** put each language under its own path, so `--starts-with` scopes a
search to one language.

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
[enabled for the space](/docs/concepts/internationalization), adds a `translated_stories` array with
one entry per language. Unlike `stages`, it appears only on the single-story response, so these
queries need the content fetch and `--skip-content` would leave nothing to match.

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

**Per-language [workflow](/docs/manuals/workflows) stages** appear in a `stages` array, one entry
per language, each carrying a `workflow_stage_id`.

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

Almost all of a run's time goes into fetching story content. The Management API's
[story listing](/docs/api/management/stories/retrieve-multiple-stories) does not include content, so
every story a client-side filter has to see needs an individual request, paced by
`--api-rate-limit`.

A run over 191 stories with three `--where` expressions divides up like this:

| Stage                | Work            | Time      |
| -------------------- | --------------- | --------- |
| Listing stories      | 1 request       | 0.6s      |
| Fetching content     | 191 requests    | **31.6s** |
| Evaluating `--where` | 352 evaluations | 0.8s      |

Client-side filtering is not what makes a run slow. Fetching stories one at a time is. Neither flag
below lifts the rate limit, and each reduces how many stories have to pass through it.

### The two flags, and the pipelines they produce

Two flags change how a run reads content:

- **`--skip-content`** does not fetch story content at all, so the output is list metadata.
- **`--capi-filter`** reads content from the Content Delivery API in bulk, instead of one story at a
  time through the Management API.

They are independent, so a run takes one of four shapes. Which one it takes determines both what a
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

Only `--capi-filter` runs a second Management API stage, and only for the stories that matched. The
bulk Content Delivery API read decides `--where`, then the matches are re-read one by one so that
the output carries Management API content.

| Combination                    | `--where` can read content | Output has `content` |
| ------------------------------ | -------------------------- | -------------------- |
| no flags                       | ✅ yes                     | ✅ yes               |
| `--skip-content`               | ❌ **no**                  | ❌ no                |
| `--capi-filter`                | ✅ yes                     | ✅ yes               |
| `--capi-filter --skip-content` | ✅ **yes**                 | ❌ no                |

<Aside type="note">
The last combination is the one worth knowing. `--capi-filter --skip-content` lets `--where` filter on story content that is not in the output. `--skip-content` on its own cannot, because with no content read anywhere, a content expression matches nothing. Adding `--capi-filter` gives the filter a bulk source of content to decide against, while the output stays list metadata.
</Aside>

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

The last command is not a slower way to get the answer. It is a fast way to get the wrong one,
because it is the one shape of the four that cannot answer a content question. The command reports
this on stderr when it happens.

### `--skip-content`

If nothing in the query needs content, do not fetch it. The content phase disappears and the run
becomes the page walk, which moves stories in bulk rather than one at a time.

The output is the story listing, which is
[the story object](/docs/api/management/stories/the-story-object) as the listing returns it, with
slugs, ids, publish state, and timestamps, but no `content` field. The run also requests the
`content_summary` digest, which the listing omits by default and which is often enough on its own to
tell two stories apart.

Use it when the question is which stories are in scope rather than what is inside them: inventories,
slug and ID lists, and publish-state counts.

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
`published`, or `stages` needs nothing that was skipped.

```bash
# Every landing page whose slug mentions a partner, in one page walk
storyblok stories find --space 12345 --starts-with lp --skip-content \
  --where "$[?search($.full_slug, 'accelerators')]"

# The content type is on the listing too, so this needs no content
storyblok stories find --space 12345 --skip-content --where "$[?($.content_type == 'product')]"
```

An expression that does read content matches nothing, since the content is not there to read. The
command warns on stderr when that leaves the run with no results at all. Adding
[`--capi-filter`](#--capi-filter) gives those expressions a source of content again, without
bringing the per-story fetch back.

Also note:

- **`--check-references` is refused**, since references live in the content it skips, leaving the
  check nothing to read.
- **API filters are unaffected.** Free-text search, `--query`, `--container-block`,
  `--includes-block`, `--starts-with`, `--entry-type`, `--tag`, `--workflow-stage`, and
  `--references` all still work.
- **`--publish-status` still works**, since it is decided from the listing.
- **Existing pipes may need a review.** `jq '.content.component'` yields `null` per line rather than
  failing, so a script that used to read content will not report the change.

### `--capi-filter`

The Content Delivery API returns content in bulk, far faster than reading stories one at a time
through the Management API.

| Content source                      | Read rate                                     |
| ----------------------------------- | --------------------------------------------- |
| Management API, one story at a time | max 6 stories per second (`--api-rate-limit`) |
| Content Delivery API, in bulk       | up to 1,250 stories per second                |

`--where` is evaluated against that bulk payload, so the only stories that still need an individual
Management API request are the ones that matched. Without the flag, a run costs one request per
story in scope. With it, one request per match, plus a bulk read fast enough to ignore.

The gain is therefore the selectivity of the query, meaning how much of the scope it discards.

| Scope         | Matched | Without the flag | With `--capi-filter` | Speedup |
| ------------- | ------: | ---------------- | -------------------- | ------- |
| 500 stories   |      50 | 84s              | **10s**              | 8×      |
| 3,951 stories |     100 | 659s (11min)     | **27s**              | 24×     |
| 3,951 stories |   1,000 | 659s             | 177s                 | 3.7×    |
| 3,951 stories |   3,900 | 659s             | 661s                 | none    |

A selective filter turns minutes into seconds. A filter that keeps almost everything gains nothing
and pays for a bulk read it could not act on, so the worst case is roughly the un-flagged run rather
than something worse.

The bulk pass is where `--where` is decided. A story it matches is a match, and the filters are not
evaluated a second time once the full story arrives. A story it decides against is never fetched at
all. Only stories it cannot decide are filtered later: folders, stories the Content Delivery API
holds no content for, and any story in a request that failed. Those are fetched and tested as usual,
so nothing reaches stdout untested.

```bash
# Same question as without the flag, a fraction of the requests
storyblok stories find --space 12345 --starts-with lp --capi-filter \
  --where "$..[?(@.component == 'customers_logos' && count(@.logos_list[*]) >= 8)]"

# Composes with the other filters as usual
storyblok stories find --space 12345 --publish-status published --includes-block hero \
  --capi-filter --where "$..[?(@.component == 'hero' && @.headline == '')]"
```

`--capi-filter` needs at least one `--where` expression to have anything to prune. Without one,
every listed story is a match, except under `--check-references`, where it plays a different role.

<Aside type="caution">
Content Delivery API content is not Management API content, and three differences can change what a `--where` expression matches.

- **Field-level translations are absent.** The Content Delivery API drops every
  `<field>__i18n__<lang>` key. That is harmless for an expression over untranslated fields, and a
  silent undercount when a **bloks** field is field-level translated, because those nested blocks
  are not in the document the filter sees. This is why `--check-references --capi-filter` warns
  before it starts.
- **Draft content carries `_editable`**, the marker the Visual Editor uses. It never reaches the
  output, but a `--where` expression mentioning `_editable` matches with the flag and not without
  it.
- **Folders have no content at all**, so they can never be pruned.

The Content Delivery API also serves content the raw Management API payload does not, and `--where`
filters on that as usual: `--capi-params "version=published"` decides against the published snapshot
rather than the draft, and `--capi-params "language=de"` decides against a language-resolved
document in [folder-level](/docs/concepts/internationalization) setups.
</Aside>

#### `--capi-filter` with `--skip-content`

This is the fastest shape a content filter has. The Content Delivery API decides every match in
bulk, and no story is fetched from the Management API at all. Use it when the question is which
stories rather than what is in them, and the answer feeds ids or slugs into something else.

```bash
# Ids of every story using a customers_logos with eight or more logos
storyblok stories find --space 12345 --starts-with lp --capi-filter --skip-content \
  --where "$..[?(@.component == 'customers_logos' && count(@.logos_list[*]) >= 8)]" \
  | jq -r '.id'
```

This combination filters on story content without putting content in the output: `--capi-filter`
gives `--where` a bulk source of content to decide against, and `--skip-content` keeps the lines
themselves list metadata.

### `--capi-params`

Adds extra query parameters to the Content Delivery API reads that `--capi-filter` makes, so
anything [the story endpoint](/docs/api/content-delivery/v2/stories/retrieve-multiple-stories)
accepts can be applied to them.

Three equivalent forms are accepted:

```bash
--capi-params '{"version":"published","language":"de"}'   # JSON
--capi-params '{version: published, language: de}'        # JSON without the quoting
--capi-params 'version=published,language=de'             # plain pairs (& also separates)
```

The command enforces two rules:

- **`version=published` requires `--publish-status published` or `changed`.** A story with no
  published version cannot be decided from published Content Delivery API content, so it has to be
  out of scope first.
- **`by_uuids`, `by_uuids_ordered`, `per_page`, and `page` are rejected**, since the command manages
  batching itself.

```bash
# What is actually live, including pages with pending edits
storyblok stories find --space 12345 --capi-filter --skip-content \
  --publish-status changed --capi-params "version=published" \
  --where "$..[?(@.component == 'hero' && @.headline == '')]"
```

## Best practices

### Narrow on the server first

Every API filter is free, because it reduces what is transferred and costs nothing locally. Every
client-side filter costs a request per story in scope. Push as much of the question as possible into
`--starts-with`, `--entry-type`, `--container-block`, `--includes-block`, `--query`, `--tag`,
`--workflow-stage`, and `--publish-status`, and leave `--where` only the part nothing else can
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

### Size the scope before running the query

`--skip-content | wc -l` answers how many stories a query will touch, in seconds. Run it with the
server-side filters only, and drop every `--where`, because the scope is what the API hands over
before any client-side filtering, and a `--where` that reads content matches nothing under
`--skip-content` in any case.

```bash
# The real query
storyblok stories find --space 12345 --includes-block hero \
  --where "$..[?(@.component == 'hero' && @.headline == '')]"

# Its scope: the same server-side filters, no --where
storyblok stories find --space 12345 --includes-block hero --skip-content | wc -l
```

Divide that count by the Management API rate limit for the number of seconds an un-flagged run
takes. If the answer is minutes, use [`--capi-filter`](#--capi-filter).

### Pick the optimization combination

1. Does the query read story content? If **no**, use `--skip-content`.
2. If **yes**, is `content` needed in the output?
   - **No**: use `--capi-filter --skip-content`, which is the fastest combination.
   - **Yes**: use `--capi-filter`, for one Management API request per match instead of per story in
     scope.
3. Does the query need something the Content Delivery API does not serve? Then neither flag fits,
   and every story has to be read from the Management API. This covers field-level translations
   (`<field>__i18n__<lang>` keys), per-language publish and workflow state, and anything else that
   lives only in the Management API story payload. See [`--capi-filter`](#--capi-filter).

### Develop the query with `--limit`, then drop it

A JSONPath expression is easy to get subtly wrong, and finding out after a full-space scan is
expensive. `--limit 5`, or `| head -5`, returns the first results in seconds.

```bash
storyblok stories find --space 12345 --includes-block hero --capi-filter --limit 5 \
  --where "$..[?(@.component == 'hero' && @.headline == '')]" | jq -r '.full_slug'
```

The run stops as soon as it has them, so iterating on an expression costs seconds regardless of the
size of the space.

### Keep destructive selections in a file

`find` only reads, so the left-hand side of a pipe is always safe. The right-hand side may not be.
Write the selection down first, review it, and then act on the file.

```bash title="Don't: nothing to review, and nothing to re-apply or audit afterwards"
storyblok stories find --space 12345 --starts-with en/campaigns/2023 --skip-content \
  | jq -r '.id' | xargs -I{} storyblok stories delete --space 12345 {}
```

```bash title="Do: write the selection down, review it, then act on the file"
storyblok stories find --space 12345 --starts-with en/campaigns/2023 --skip-content \
  > selection.jsonl
wc -l selection.jsonl
jq -r '.full_slug' selection.jsonl | less
# only then
jq -r '.id' selection.jsonl | xargs -I{} storyblok stories delete --space 12345 {}
```

This keeps the set re-appliable, auditable, and diffable, and it closes the window in which a story
can move between the read and the write.

### Exclude folders under `--capi-filter`

The Content Delivery API holds no content for folders, so every folder in scope passes through the
bulk stage undecided and costs an individual Management API request in any case. Adding
`--entry-type story` excludes them, and usually removes the "could not be decided" warning as well.

### Sort with `--sort` rather than in the output

`jq -s 'sort_by(...)'` has to buffer the whole result set before it can emit the first line, which
discards the streaming. `--sort` is applied by the API, so it decides which stories are on the first
page, which is what makes `--limit` return the top results rather than an arbitrary set.

```bash title="Don't: the whole result set is buffered before the first line appears"
storyblok stories find --space 12345 --starts-with en/blog \
  | jq -s 'sort_by(.updated_at) | reverse | .[0:10]'
```

```bash title="Do: the API sorts, and the run stops after ten stories"
storyblok stories find --space 12345 --starts-with en/blog --sort updated_at:desc --limit 10
```

## Related

<LinkCard
  title="Storyblok CLI"
  description="Every command the CLI provides, with its flags and examples."
  href="/docs/libraries/storyblok-cli"
/>

<LinkCard
  title="Management API: retrieve multiple stories"
  description="The story listing endpoint and the parameters the server-side filters map onto."
  href="/docs/api/management/stories/retrieve-multiple-stories"
/>

<LinkCard
  title="Content Delivery API: retrieve multiple stories"
  description="The endpoint --capi-filter reads content from, and the parameters --capi-params accepts."
  href="/docs/api/content-delivery/v2/stories/retrieve-multiple-stories"
/>
