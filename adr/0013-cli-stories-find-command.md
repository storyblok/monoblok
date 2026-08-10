# ADR-0012: CLI `stories find` Command

**Status:** Accepted
**Date:** 2026-08-03

## Context

The CLI lacks a content discovery command. Users who need to find stories by component, publish state, translation status, or content attributes must either use the Storyblok web UI or write custom scripts against the API. Common content-ops tasks — auditing stale translations, finding stories with specific blocks, locating unpublished changes — have no CLI-native workflow.

The `stories find` command fills this gap. Its design required resolving several open questions about API choice, case sensitivity, publish-status modeling, and translation filtering. These were investigated against the backend source (storyrails) and the generated MAPI/CAPI specs.

## Decisions

### 1. Use MAPI, not CAPI

The Management API is used for all `find` queries. Three capabilities critical to `find` are MAPI-exclusive:

- **`contain_component`** — server-side block-presence filtering (`--contains-block`).
- **`unpublished_changes`** on the story response — required to distinguish "published" from "changed" (`--publish-status changed`).
- **`translated_stories`** metadata array (via `with_translated_stories=true`) — required for all `--translation-status` filtering. CAPI does not expose per-language `published_at` or `unpublished_changes`.

CAPI's exclusive features (`language` content parameter, date-range filters, `resolve_relations`) are either not needed for discovery filtering or expressible via `--query`/`--where`.

### 2. No `--ignore-case` flag

The MAPI `text_search` is always case-insensitive. The backend uses PostgreSQL `ILIKE` and `.downcase()` (`storyrails/app/models/concerns/text_searchable.rb:25-59`). The `like` operator in `filter_query` also uses `ILIKE` (`storyrails/app/models/story.rb:591-594`). Tests explicitly verify this (`storyrails/spec/models/story_spec.rb:2342-2392`). An `--ignore-case` flag would mislead users into thinking case-sensitive is the default. For client-side `--where` (JSONPath), `=~` regex with `/i` provides case-insensitive matching.

### 3. `--publish-status` as a three-value enum with server/client split

A boolean `--published` would collapse three distinct states into two. The `--publish-status` enum maps to:

| Value | Server-side | Client-side |
|---|---|---|
| `published` | `is_published=true` | `unpublished_changes === false` |
| `changed` | `is_published=true` | `unpublished_changes === true` |
| `draft` | `is_published=false` | _(none)_ |

Both `published` and `changed` share the same server-side filter; only `unpublished_changes` distinguishes them client-side.

### 4. `--translation-status` with `stale` detection

Translation filtering is entirely client-side (MAPI has no server-side translation params). The command passes `with_translated_stories=true` to include per-language metadata in the response. Four status values:

| Status | Logic | Multi-language aggregation |
|---|---|---|
| `missing` | No entry for lang, or `published_at === null` | **ANY** |
| `stale` | `translation.published_at < story.published_at` | **ANY** |
| `unpublished` | `unpublished_changes === true` | **ANY** |
| `complete` | Entry exists, `published_at !== null`, `translation.published_at >= story.published_at` | **ALL** |

Problem-surfacing statuses (`missing`, `stale`, `unpublished`) use ANY — include the story if any specified language has the problem. Completeness (`complete`) uses ALL — include only if all specified languages are complete.

The `stale` status compares timestamps and is intentionally conservative: any republish of the default language flags all translations as stale, even for unrelated changes. This is preferred over missing genuinely stale translations.

An earlier `all` value (meaning "no filtering") was dropped because omitting the flag achieves the same.

### 5. JSONL to stdout, UI to stderr

Output follows Unix piping conventions. Each matching story is written as a complete JSON object on one line to stdout. All UI (spinners, progress, summary) goes to stderr via `getUI()`. This enables `jq`, `wc -l`, `grep`, `>` redirection, and `xargs` piping without any special flags.

### 6. JSONPath (RFC 9535) for `--where`

Client-side filtering uses the JSONPath standard via `jsonpath-plus` rather than a custom expression language. Users may already know the syntax from jq, AWS CLI, or Kubernetes. The `--where` flag is repeatable; multiple expressions compose with AND.

## Alternatives Considered

- **CAPI for find.** Rejected: lacks `contain_component`, `unpublished_changes`, and `translated_stories` metadata — all critical for the designed filtering pipeline.
- **`--ignore-case` flag.** Rejected: the API is always case-insensitive; the flag would be misleading and non-functional.
- **Boolean `--published` flag.** Rejected: collapses three states (published, changed, draft) into two.
- **Custom expression language for `--where`.** Rejected: JSONPath is a well-known standard (RFC 9535), avoids designing and documenting a custom syntax.
- **`--translation-status all` (no filtering).** Rejected: ambiguous naming; omitting the flag achieves the same result.
- **Staleness detection via content diffing.** Rejected: comparing `published_at` timestamps is sufficient and avoids the complexity of content-level diffing between language versions.

## Consequences

- **MAPI dependency** — the `find` command requires a personal access token (MAPI auth), not a public CAPI token. This is consistent with all other CLI commands.
- **`stale` false positives** — any republish of the default language flags all translations as stale, even for unrelated changes. Acceptable: content-ops teams should verify rather than assume.
- **`jsonpath-plus` added as a dependency** — small, well-established library (RFC 9535 compliant). Used only at runtime when `--where` is specified.
- **All translation filtering is client-side** — stories must be fetched before filtering by translation status. Mitigated by combining with server-side filters (`--root-block`, `--starts-with`, `--query`) to reduce the fetch set.
- **Downstream commands use `id`/`uuid` from JSONL output** — they should refetch via MAPI before mutating, not replay the full `find` payload.
