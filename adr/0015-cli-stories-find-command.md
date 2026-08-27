# ADR-0015: CLI `stories find` Command

**Status:** Accepted **Date:** 2026-08-03

## Context

The CLI lacks a content discovery command. Users who need to find stories by block, publish state,
or content attributes must either use the Storyblok web UI or write custom scripts against the API.
Common content-ops tasks — auditing translations, finding stories with specific blocks, locating
unpublished changes, spotting references broken by a restructure — have no CLI-native workflow.

The `stories find` command fills this gap. Its design required resolving several open questions
about API choice, case sensitivity, publish-status modeling, and how far to go in giving each
content question its own flag. These were investigated against the backend behavior and the
generated MAPI/CAPI specs.

## Decisions

### 1. MAPI is the query API; CAPI is an opt-in accelerator

The Management API answers every `find` query. Three capabilities the command depends on are
MAPI-exclusive:

- **`contain_component`** — server-side block-presence filtering (`--includes-block`).
- **`unpublished_changes`** on the story response — required to distinguish "published" from
  "changed" (`--publish-status changed`).
- **`translated_stories`** metadata (via `with_translated_stories=true`) — per-language
  `published_at` and `unpublished_changes`, which CAPI does not expose.

CAPI enters only as a bulk content _source_ behind `--capi-filter`: MAPI serves content one story
per request, the CDN serves 25 per request, so pre-filtering candidates against CAPI content and
fetching only the survivors from MAPI is dramatically cheaper on large scopes. The stage only ever
prunes — anything CAPI cannot answer for passes through undecided and is settled by MAPI — so the
result set is the same with and without the flag.

### 2. No `--ignore-case` flag

MAPI `text_search` is always case-insensitive, and the `like` operator in `filter_query` is too. An
`--ignore-case` flag would imply case-sensitive is the default, which it is not. For client-side
`--where` (JSONPath), the `=~` regex operator with `/i` provides case-insensitive matching.

### 3. `--publish-status` as a three-value enum with a server/client split

A boolean `--published` would collapse three distinct states into two. The `--publish-status` enum
maps to:

| Value       | Server-side          | Client-side                     |
| ----------- | -------------------- | ------------------------------- |
| `published` | `is_published=true`  | `unpublished_changes === false` |
| `changed`   | `is_published=true`  | `unpublished_changes === true`  |
| `draft`     | `is_published=false` | _(none)_                        |

Both `published` and `changed` share the same server-side filter; only `unpublished_changes`
distinguishes them. The client-side half runs before the content fetch, so a non-matching story
costs nothing beyond the page it was listed on.

### 4. `--where` (JSONPath) instead of a flag per content question

Client-side filtering uses JSONPath (RFC 9535) via `json-p3`. Users may already know the syntax from
jq, AWS CLI, or Kubernetes. The flag is repeatable; multiple expressions compose with AND.

`find` deliberately does **not** grow a flag for every question that `--where` can already ask. An
earlier design had a `--translation-status <missing|stale|unpublished|complete>` enum; it was
dropped because each value is one JSONPath expression over the `translated_stories` metadata the
response already carries, and the enum baked in aggregation rules (ANY for problems, ALL for
completeness) that users could not adjust. The same reasoning keeps date-range, author, and tag
filters out of the flag surface.

The exception is a filter the server can push down (`--includes-block`, `--container-block`,
`--starts-with`, `--query`, `--references`, `--publish-status`): those earn a flag because they
change what is fetched, not just what is kept.

### 5. `--check-references` as a client-side scan

Broken and stale references cannot be expressed as a filter over a single story: deciding them needs
the _target's_ current slug and publish state. So `--check-references` is a distinct mode rather
than a `--where` recipe. It walks each story's content for multilink, richtext, and story-relation
fields, resolves every target uuid (batched, including targets outside the search scope), and
annotates each story with a `_ref_issues` array. `--where` can then filter on that array like any
other field.

### 6. `--skip-content` as an explicit opt-out

The per-story content fetch dominates the runtime of any large scope. When the question is "which
stories are in scope" rather than "what is inside them", `--skip-content` drops that phase entirely
and the run becomes the page walk, which moves 100 stories per request. It is rejected in
combination with anything that has no other content source (`--check-references`).

### 7. JSONL to stdout, UI to stderr, and stdout never waits for the UI

Output follows Unix piping conventions. Each matching story is written as a complete JSON object on
one line to stdout. All UI (spinners, progress, summary) goes to stderr via `getUI()`. This enables
`jq`, `wc -l`, `grep`, `>` redirection, and `xargs` piping without any special flags. A downstream
reader that exits early (`| head -5`) terminates the run rather than being written to a closed pipe.

Results stream as they are produced, unconditionally. An earlier version held them back while
progress bars were drawing on a terminal, so that a downstream `jq` printing to that same terminal
could not garble them. That was the wrong trade: it defeated the only property line-oriented output
has over a single JSON array — that a reader can act on the first line without waiting for the last
— and it did so for a condition this process cannot observe, since whether the downstream command
prints to the terminal or to a file is a property of that command. It also held the entire result
set in memory and made the early-exit above unreachable in the interactive case.

The one collision that _is_ observable is stdout being a terminal, which puts the results and the
bars on the same screen with certainty rather than by guess. Progress rendering is dropped for those
runs; text output on stderr, which scrolls rather than redraws, stays. Everything else is left to
the user, who knows what is downstream: `2>/dev/null`, or the global `--no-ui-enabled`.

## Alternatives Considered

- **CAPI as the query API.** Rejected: lacks `contain_component`, `unpublished_changes`, and
  `translated_stories` metadata — all critical for the filtering pipeline.
- **`--ignore-case` flag.** Rejected: the API is always case-insensitive; the flag would be
  misleading and non-functional.
- **Boolean `--published` flag.** Rejected: collapses three states (published, changed, draft) into
  two.
- **Custom expression language for `--where`.** Rejected: JSONPath is a well-known standard (RFC
  9535), avoids designing and documenting a custom syntax.
- **`--translation-status` enum.** Rejected: expressible as `--where` over `translated_stories`, and
  the enum hard-coded aggregation rules users could not adjust.
- **Staleness detection via content diffing.** Rejected: comparing `published_at` timestamps is
  sufficient and avoids the complexity of content-level diffing between language versions.

## Consequences

- **MAPI dependency** — `find` requires a personal access token (MAPI auth), not a public CAPI
  token. This is consistent with all other CLI commands. `--capi-filter` additionally resolves the
  space's public token, so it fails as a usage error on a space without one.
- **`json-p3` added as a dependency** — small, RFC 9535 compliant. Loaded regardless, used only when
  `--where` is specified.
- **Content-dependent filters require the content fetch** — mitigated by combining with server-side
  filters to reduce the fetch set, by `--capi-filter` to prune it in bulk, or by `--skip-content`
  when content is not needed at all.
- **The flag surface stays small, the `--where` surface stays large** — users asking a content
  question have to write JSONPath. Discoverability moves to documented recipes rather than to
  `--help`.
- **Downstream commands use `id`/`uuid` from JSONL output** — they should refetch via MAPI before
  mutating, not replay the full `find` payload.
