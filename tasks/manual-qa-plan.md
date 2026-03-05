# Fix Plan — `@storyblok/api-client` QA Findings

Fixes for all findings documented in `tasks/manual-qa-findings.md`.

## Step 1 — Fix `spaces.get()` token attachment bug (F1)

**File:** `packages/capi-client/src/resources/spaces.ts`

The callback passed to `requestWithCache` must accept and forward `requestQuery` to the generated SDK call. Currently the callback ignores the parameter:

```ts
// Current (broken):
return requestWithCache('GET', requestPath, {}, () => {
  return asApiResponse(getSpaceApi({ client, signal, ... }));
});

// Fixed:
return requestWithCache('GET', requestPath, {}, (requestQuery) => {
  return asApiResponse(getSpaceApi({ client, query: requestQuery, signal, ... }));
});
```

This ensures the `query` object exists when `setAuthParams` runs inside `beforeRequest`, allowing the token to be appended to the URL.

**Unit test update:** The existing `spaces.test.ts` passes because MSW intercepts before the real network, masking the bug. Add a test that verifies the token appears in the request URL via an interceptor.

## Step 2 — Convert all `nullable: true` to OpenAPI 3.1 syntax (F2, F3, F5, F6)

**Root cause:** All 51 occurrences of `nullable: true` in `packages/openapi/resources/` use the OpenAPI 3.0 keyword, but the specs declare `openapi: 3.1.1`. `@hey-api/openapi-ts` correctly ignores the 3.0-era keyword for 3.1 specs.

**Change pattern** for each occurrence:

```yaml
# Before (3.0-style, ignored by hey-api for 3.1 specs):
parent_id:
  type: integer
  nullable: true

# After (3.1-compliant):
parent_id:
  type:
    - integer
    - "null"
```

### Files and fields affected

**`shared/stories/story-base.yaml`** — 6 fields:

- `parent_id` (`integer`)
- `sort_by_date` (`string`)
- `published_at` (`string`)
- `path` (`string`)
- `meta_data` (`object`)
- `first_published_at` (`string`)

**`capi/shared/stories/story-capi.yaml`** — 2 fields:

- `default_full_slug` (`string`)
- `release_id` (`integer`)

**`shared/stories/field-types/asset-field.yaml`** — 6 fields:

- `id` (`integer`)
- `alt` (`string`)
- `focus` (`string`)
- `title` (`string`)
- `source` (`string`)
- `copyright` (`string`)

**`capi/shared/links/link-capi.yaml`** — 2 fields + 1 nested:

- `path` (`string`)
- `parent_id` (`integer`)
- `alternates[].path` (`string`)

**`shared/stories/story-alternate.yaml`** — 1 field:

- `parent_id` (`integer`)

**`shared/stories/story-translated-slug.yaml`** — 3 fields:

- `path` (`string`)
- `name` (`string`)
- `published` (`boolean`)

**`shared/stories/story-localized-path.yaml`** — 2 fields:

- `name` (`string`)
- `published` (`boolean`)

**`shared/stories/field-types/multilink-field.yaml`** — 2 fields:

- `anchor` (`string`)
- `target` (`string`)

**`capi/datasource_entries/main.yaml`** — 1 field:

- `dimension_value` (`string`)

**`capi/shared/datasources/datasource-entry-capi.yaml`** — 1 field:

- `dimension_value` (`string`)

**`mapi/stories/schemas/story-update.yaml`** — 4 fields
**`mapi/stories/schemas/story-create.yaml`** — 4 fields
**`mapi/stories/schemas/story-mapi.yaml`** — 3 fields
**`mapi/components/component-create.yaml`** — 1 field
**`mapi/components/component-update.yaml`** — 1 field
**`mapi/components/component.yaml`** — 5 fields
**`mapi/spaces/main.yaml`** — 3 fields
**`mapi/asset_folders/main.yaml`** — 3 fields

Additionally for F3, `translated_slugs` in `story-base.yaml` must be made nullable:

```yaml
# Before:
translated_slugs:
  type: array

# After:
translated_slugs:
  type:
    - array
    - "null"
```

## Step 3 — Fix `AssetField` required fields (F4)

**File:** `packages/openapi/resources/shared/stories/field-types/asset-field.yaml`

Remove `name`, `title`, `focus` from the `required` array. The API omits these fields entirely when they are not set.

```yaml
# Before:
required:
  - fieldtype
  - id
  - filename
  - name
  - alt
  - title
  - focus

# After:
required:
  - fieldtype
  - id
  - filename
  - alt
```

The properties stay defined, they just become optional.

## Step 4 — Fix `StoryBase.meta_data` missing from generated type (F8)

**File:** `packages/openapi/resources/shared/stories/story-base.yaml`

Add `additionalProperties: true` to `meta_data` so the codegen recognizes it as a meaningful object type instead of dropping it:

```yaml
# After (with step 2's nullable fix applied):
meta_data:
  type:
    - object
    - "null"
  additionalProperties: true
  description: Object to store non-editable data that is exclusively maintained with the Management API
```

## Step 5 — Add missing date fields to `LinkCapi` (F7)

**File:** `packages/openapi/resources/capi/shared/links/link-capi.yaml`

Add `published_at`, `created_at`, `updated_at` as optional properties (NOT in `required`). These are conditionally returned when `include_dates=1`:

```yaml
# Add to properties section (not to required):
published_at:
  type:
    - string
    - "null"
  format: date-time
  description: Publishing date (only present when include_dates=1)
created_at:
  type: string
  format: date-time
  description: Creation date (only present when include_dates=1)
updated_at:
  type: string
  format: date-time
  description: Last update date (only present when include_dates=1)
```

## Step 6 — Regenerate types and rebuild

After all spec changes:

1. `pnpm nx build @storyblok/openapi` — rebundle specs.
2. `pnpm --filter @storyblok/api-client generate` — regenerate TypeScript types.
3. `pnpm nx build @storyblok/api-client` — rebuild the package.
4. Verify generated types include `| null` where expected.
5. Run lint: `pnpm nx lint @storyblok/api-client --fix`.

## Step 7 — Run unit tests and fix any type errors

`pnpm nx test @storyblok/api-client` — existing unit tests may need updates because:

- `StoryBase` properties that were `string` are now `string | null` — any test assertions comparing to a non-nullable type may need adjustment.
- `AssetField` properties that were required are now optional — destructuring or property access may need optional chaining.

## Step 8 — Rerun manual QA tests

Rerun the test scripts from `.claude/tmp/` against the live QA space to verify:

- `spaces.get()` returns data (F1 fixed).
- Type shapes align with API responses (F2-F8 fixed).
