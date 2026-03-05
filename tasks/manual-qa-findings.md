# `@storyblok/api-client` Manual QA Findings

- **Functions tested:** All public API surface: `stories.get`, `stories.getAll`, `links.getAll`, `spaces.get`, `datasources.get`, `datasources.getAll`, `datasourceEntries.getAll`, `tags.getAll`, `client.get`, `client.flushCache`, `client.interceptors`, `createThrottle`, `parseRateLimitPolicyHeader`
- **Outcome:** PARTIAL — 1 critical runtime bug, 7 type-accuracy issues
- **QA Space ID:** `290020686946333`

## Test execution summary

| Test group | Tests | Passed | Failed | Notes |
|---|---|---|---|---|
| T1: `stories.get()` | 11 | 11 | 0 | slug, ID, UUID, resolve_links, language, response shape |
| T2: `stories.getAll()` | 16 | 15 | 1 | `excluding_fields` observation (O1) |
| T3: `links.getAll()` | 6 | 6 | 0 | draft, shape, starts_with, include_dates, paginated, published |
| T4: `spaces.get()` | 3 | 0 | 3 | **F1**: token not attached |
| T5: datasources / entries | 8 | 8 | 0 | get, getAll, shape, pagination, slug filter |
| T6: `tags.getAll()` | 3 | 3 | 0 | basic, version, starts_with |
| T7: `client.get()` | 5 | 5 | 0 | stories, links, typed generic, spaces w/ and w/o query |
| T8: Error handling | 8 | 8 | 0 | 404, ClientError shape, throwOnError true/false, per-request override, 401 |
| T9: Caching | 10 | 10 | 0 | cache-first, network-first, swr, TTL, flush, custom provider/strategy |
| T10: inlineRelations | 7 | 7 | 0 | false/true, no relations, getAll, non-UUID field unchanged |
| T11: Interceptors | 8 | 8 | 0 | use/eject/exists/update/clear, order, request/response/error |
| T12: Utilities | 6 | 6 | 0 | createThrottle, parseRateLimitPolicyHeader |
| T13: Runtime type shapes | 5 | 5 | 0 | Story, Link, Datasource, ApiResponse success/error |
| T14: Edge cases | 9 | 9 | 0 | AbortSignal, baseUrl, region, rateLimit, retry, empty results, timeout, headers |
| Type comparison | 141 | 116 | 25 | Detailed below |

## Findings that need fixing

### F1 — `client.spaces.get()` always returns HTTP 401 (CRITICAL)

**Location:** `packages/capi-client/src/resources/spaces.ts:14`

The `spaces.get()` resource callback passes no `query` to `getSpaceApi({ client, signal })`. In `beforeRequest` (generated client), `setAuthParams` is called with `{ ...opts, security }` — a spread of `opts`. When `opts.query` is `undefined` (no query was provided), `setAuthParams` creates a new `options.query = {}` and appends the `token`, but because the spread created a new reference, the mutation does not propagate back to `opts.query`. Consequently, `buildUrl(opts)` builds the URL without the `token` query parameter.

```
Intercepted URL: https://api.storyblok.com/v2/cdn/spaces/me       (no token)
Expected URL:    https://api.storyblok.com/v2/cdn/spaces/me?token=<TOKEN>
```

Workaround: `client.get('/v2/cdn/spaces/me', { query: { any_key: 'value' } })` works because `requestNetwork` always passes `query: options.query || {}`. All other resources are unaffected because they always pass a query object.

The existing `spaces.test.ts` passes because MSW intercepts requests before they reach the real network, masking the bug.

### F2 — `StoryCapi`: 7 fields nullable at runtime but typed non-nullable (MEDIUM)

All fields are declared required and non-nullable in `StoryBase` / `StoryCapi`, but the API returns `null` for unpublished or untranslated stories:

| Field | Declared type | Actual for draft/unpublished |
|---|---|---|
| `sort_by_date` | `string` (required) | `null` (9/9 stories) |
| `published_at` | `string` (required) | `null` (9/9 stories) |
| `first_published_at` | `string` (required) | `null` (9/9 stories) |
| `path` | `string` (required) | `null` (9/9 stories) |
| `parent_id` | `number` (required) | `null` (4/9 root stories) |
| `release_id` | `number` (required) | `null` (5/9 stories) |
| `default_full_slug` | `string` (required) | `null` (5/9 stories) |

**Root cause:** The OpenAPI specs use `nullable: true` (a 3.0 keyword), but all specs declare `openapi: 3.1.1`. `@hey-api/openapi-ts` correctly ignores the 3.0-era keyword for 3.1 specs.

### F3 — `StoryCapi.translated_slugs`: typed `Array`, API returns `null` (MEDIUM)

```
// Type:   translated_slugs: Array<StoryTranslatedSlug>  (required, non-null)
// Actual: translated_slugs: null
```

When the Translatable Slugs app is not installed, the API returns `null` instead of `[]`. The spec does not mark it as nullable.

### F4 — `AssetField`: `name`, `title`, `focus` declared required but absent from API (HIGH)

```
// Type:   name: string, title: string, focus: string  (all required)
// Actual: { id: 1, alt: "Hero image", filename: "...", fieldtype: "asset" }
// name, title, focus are ABSENT
```

Most simple assets don't have these set. The spec lists them in the `required` array, but the API omits them when blank.

### F5 — `AssetField`: nullable fields not typed nullable (MEDIUM)

`id`, `alt`, `title`, `focus`, `source`, `copyright` all have `nullable: true` in the spec but generate as non-nullable types. Same root cause as F2.

### F6 — `LinkCapi`: `path` and `parent_id` nullable but typed non-nullable (LOW)

Same root cause as F2. Both fields have `nullable: true` in the spec but generate as plain `string` / `number`.

### F7 — `LinkCapi`: missing `published_at`, `created_at`, `updated_at` fields (LOW)

When `include_dates=1` is passed to `links.getAll()`, the API adds three extra fields that are not declared in `LinkCapi`:

```
published_at: null | string
created_at:   string
updated_at:   string
```

These fields are absent from the `link-capi.yaml` schema entirely.

### F8 — `StoryCapi.meta_data`: present in every response but absent from generated type (LOW)

Every story response includes `meta_data: null` (or an object when metadata is set). The field IS in the spec (`story-base.yaml` line 90-93, required, `type: object, nullable: true`), but the generated `StoryBase` type does not include it. The codegen likely drops bare `type: object` with no `properties` or `additionalProperties` defined.

## Findings that do NOT need code fixes

### O1 — `excluding_fields` does not work with `version: 'draft'`

`stories.getAll({ query: { version: 'draft', excluding_fields: 'content,created_at' } })` returns the full story including `content` and `created_at`. Verified via raw curl. This is Storyblok API behavior, not a client bug.

### O2 — `inlineRelations` could not be fully tested with seeded data

The `has-stories` scenario uses `multilink` fields for cross-story references, not UUID-based relation fields. `resolve_relations` only works with explicit relation field types. UUID inlining behavior (`rel_uuids` overflow fetching) could not be exercised.

### O3 — `StoryContent` dynamic fields show as undeclared in type checks

Fields like `body`, `title`, `author`, `category`, `related_post`, `featured_image` appear as undeclared because they are component-defined fields surfaced via the `[key: string]: ...` index signature. Expected behavior.

### O4 — `GetResponses.links` typed as `Array<{[key:string]:unknown}>`

The `links` field in story responses (when `resolve_links` is used) is typed as a generic array with index signature. The actual API returns either full `StoryCapi` objects (with `resolve_links=story`) or lightweight link summaries (with `resolve_links=url`). The type is permissive but loses type safety. Low priority improvement.
