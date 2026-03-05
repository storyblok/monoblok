# Part 0: Refactor MAPI — Use Shared OpenAPI Specs and Align API with CAPI

Refactor `@storyblok/management-api-client` (`packages/mapi-client`) to use the new shared OpenAPI specs introduced with the CAPI client, align its public API surface with `@storyblok/api-client` (`packages/capi-client`), migrate from raw `fetch` to `ky`, and switch from class-based instantiation to a factory function pattern.

## Acceptance criteria

- MAPI OpenAPI specs (`packages/openapi/resources/mapi/`) reference the global shared specs (`packages/openapi/resources/shared/`) for stories, field types, pagination, responses, and parameters — eliminating duplicated definitions.
- MAPI story schema uses `allOf` composition with `shared/stories/story-base.yaml` + MAPI-specific extension (matching the pattern used by `story-capi.yaml`).
- MAPI story schema includes all fields documented in the [official MAPI Story Object docs](https://www.storyblok.com/docs/api/management/stories/the-story-object), including currently missing fields: `user_ids`, `space_role_ids`, `release_ids`, `current_version_id`, `base_version_id`, `main_version_id`, `stage`.
- MAPI method naming is aligned with CAPI: `list` → `getAll`, `updateStory` → `update`, `deleteComponent` → `delete`, `updateDatasourceEntry` → `update`.
- MAPI client uses `ky` as its HTTP transport (like CAPI), with preventive token-bucket throttling (copied from CAPI's generic `createThrottle`), preserving `ClientError`, and configurable retry/timeout/rate-limit.
- MAPI client uses a factory function (`createManagementApiClient(config)`) instead of `new ManagementApiClient(config)`.
- `@hey-api/openapi-ts` is upgraded from `^0.80.1` to `^0.92.x` (matching CAPI).
- `pnpm --filter @storyblok/management-api-client test:ci` passes.
- `pnpm --filter @storyblok/management-api-client build` succeeds.
- `pnpm --filter @storyblok/management-api-client lint` passes.

---

## Context

The `@storyblok/api-client` (CAPI client, `packages/capi-client/`) was recently built from scratch with modern patterns:

- **Shared OpenAPI specs**: The CAPI story schema (`resources/capi/shared/stories/story-capi.yaml`) composes from `shared/stories/story-base.yaml` via `allOf`, so both APIs share the same base story definition, field-type schemas (asset, multilink, richtext, table, plugin), pagination, and parameters.
- **`ky`-based HTTP client**: Battle-tested retry, built-in timeout, proper `Retry-After` handling.
- **Factory function**: `createApiClient(config)` returns a plain object — no class inheritance.
- **Consistent naming**: `get` / `getAll` for retrieval, positional identifiers.
- **`@hey-api/openapi-ts` v0.92**: Latest code generator with ky client support.

The MAPI client predates these patterns. Its OpenAPI specs are fully independent (zero `$ref` paths to `resources/shared/`), it uses raw `fetch` with hand-rolled retry, class-based instantiation, and has inconsistent method naming (`list`, `updateStory`, `deleteComponent`). This task brings the MAPI client in line with the CAPI architecture.

**What the MAPI does NOT need from the CAPI:**
- **Caching** — Management API responses are mutable and write-heavy. There is no `cv` cache-version concept, no CDN layer, and no benefit to caching responses. Do not add `CacheProvider`, cache strategies, or any caching infrastructure.
- **Multi-tier rate limiting** — The CAPI uses per-tier token buckets because CDN endpoints have different concurrency limits depending on the path and `per_page`. The MAPI has a single flat rate limit per plan. Use **one fixed-limit bucket** (default `maxConcurrent: 6`) with optional server-header adaptation — no tier detection, no path matching.

### Current state of MAPI shared files vs global shared files

| File | Status |
|---|---|
| `mapi/shared/responses.yaml` | Semantically identical to `shared/responses.yaml` — direct replacement. |
| `mapi/shared/pagination.yaml` | Nearly identical; only difference is `shared/pagination.yaml` has `maximum: 100` on `per_page`, MAPI version does not. Verify via API whether MAPI enforces a max. |
| `mapi/shared/parameters.yaml` | Allows `oneOf: [integer, string]` for IDs; global shared uses `oneOf: [integer]` only. Also has extra `asset_folder_id`. Investigate which is correct (see 0.2). |
| `mapi/shared/servers.yaml` | MAPI-only (different base URLs than CAPI). Keep as-is. |
| `mapi/shared/security.yaml` | MAPI-only (different auth scheme). Keep as-is. |
| `mapi/shared/security-schemes.yaml` | MAPI-only. Keep as-is. |

---

## Status: COMPLETE ✅

All subtasks (0.1–0.6, 0.8, 0.9) have been implemented. See the Accomplished section in the conversation context for details.

---

## 0.1 Upgrade `@hey-api/openapi-ts` to v0.92+

Upgrade the code generator from `^0.80.1` to match the CAPI's `^0.92.3`. This is a prerequisite for ky client support and the newer SDK generation features.

**Files to update:**

- `packages/mapi-client/package.json`: Update `@hey-api/openapi-ts` version, replace `@hey-api/client-fetch` with `@hey-api/client-ky`, add `ky` as a runtime dependency.
- `packages/mapi-client/generate.ts`: Update the `createClient` call to use the new API surface of v0.92. Key changes:
  - Plugin names may have changed between v0.80 and v0.92.
  - The `asClass: true, instance: true` SDK plugin options should be **removed** (switching to function-based generation to support the factory function pattern).
  - The client plugin should change from `@hey-api/client-fetch` to `@hey-api/client-ky`.

Reference the CAPI's `packages/capi-client/scripts/generate.ts` for the correct v0.92 plugin configuration.

After upgrading, regenerate all SDK code:
```sh
pnpm --filter @storyblok/management-api-client generate
```

Verify the generated output compiles and review the structural changes in `src/generated/`.

---

## 0.2 Align MAPI OpenAPI specs with shared specs

### 0.2.1 Investigate parameter types

Before making changes, verify whether the MAPI truly accepts string IDs for `space_id`, `story_id`, etc., or if the `oneOf: [integer, string]` in `mapi/shared/parameters.yaml` is incorrect.

**How to verify:**
- Use the `qa-engineer-manual` skill to query the MAPI with a string space ID and an integer space ID. Check if both work or if strings are rejected/coerced.
- Check the official MAPI docs for parameter type documentation.
- If only integers are valid: update `shared/parameters.yaml` to be the single source of truth and have MAPI reference it.
- If strings are also valid: either update `shared/parameters.yaml` to accept both (since integer is a valid subset of string in JSON Schema), or have MAPI extend the shared params with an override.
- `asset_folder_id` is MAPI-specific — if not needed by CAPI, keep it in a MAPI-specific parameters file.

### 0.2.2 Replace `mapi/shared/responses.yaml` with shared ref

All MAPI resource specs that reference `../shared/responses.yaml` should be updated to reference `../../shared/responses.yaml` instead. Then delete `mapi/shared/responses.yaml`.

Currently only `presets/main.yaml` references it. Scan all MAPI resource specs and add shared error responses to any that are missing them.

### 0.2.3 Align `mapi/shared/pagination.yaml`

Verify whether the MAPI enforces a `per_page` maximum of 100 (like the CAPI). If yes, MAPI can reference `shared/pagination.yaml` directly. If not, MAPI can extend it with a local override removing the maximum constraint.

### 0.2.4 Refactor MAPI story schema to use `allOf` with `story-base.yaml`

This is the most impactful change. Refactor `packages/openapi/resources/mapi/stories/schemas/story.yaml` to follow the same composition pattern as `capi/shared/stories/story-capi.yaml`:

```yaml
# packages/openapi/resources/mapi/stories/schemas/story-mapi.yaml (renamed)
type: object
description: Storyblok story object from the Management API.
allOf:
  - $ref: ../../../../shared/stories/story-base.yaml
  - type: object
    properties:
      # --- MAPI-specific fields ---
      deleted_at:
        type: string
        format: date-time
        nullable: true
        description: Deletion date and time.
      is_folder:
        type: boolean
        description: Whether the entry is a folder.
      published:
        type: boolean
        description: Whether the story is currently published.
      default_root:
        type: string
        nullable: true
        description: Default content type for stories in this folder.
      disable_fe_editor:
        type: boolean
        description: Whether the Visual Editor is disabled.
      parent:
        type: object
        additionalProperties: true
        description: Subset of parent folder info (resolved from parent_id).
      unpublished_changes:
        type: boolean
        description: Whether the story has unpublished changes.
      imported_at:
        type: string
        format: date-time
        nullable: true
        description: Latest import date.
      preview_token:
        type: object
        properties:
          token:
            type: string
          timestamp:
            type: string
      pinned:
        type: boolean
        description: Legacy UI feature replaced by favourite_for_user_ids.
      breadcrumbs:
        type: array
        items:
          type: object
          properties:
            id:
              type: integer
            name:
              type: string
            parent_id:
              type: integer
            disable_fe_editor:
              type: boolean
            path:
              type: string
            slug:
              type: string
            translated_slugs:
              type: array
              items:
                $ref: ../../../../shared/stories/story-translated-slug.yaml
      last_author:
        type: object
        properties:
          id:
            type: integer
          userid:
            type: string
          friendly_name:
            type: string
      last_author_id:
        type: integer
        description: ID of the last user who interacted with the story.
      translated_slugs_attributes:
        type: array
        items:
          type: object
          properties:
            id:
              type: integer
            lang:
              type: string
            slug:
              type: string
            name:
              type: string
            published:
              type: boolean
      release_id:
        type: integer
        description: ID of the current release.
      scheduled_dates:
        type: string
        format: date-time
        description: Scheduled publishing date.
      favourite_for_user_ids:
        type: array
        items:
          type: integer
        description: User IDs who saved the story as Favorite.
      # --- Fields from official docs missing in current spec ---
      user_ids:
        type: array
        items:
          type: integer
        description: User IDs assigned to a workflow stage.
      space_role_ids:
        type: array
        items:
          type: integer
        description: Space role IDs assigned to a workflow stage.
      release_ids:
        type: array
        items:
          type: integer
        description: Release IDs associated with the story.
      current_version_id:
        type: integer
        description: Version ID of the story's latest content within the release.
      base_version_id:
        type: integer
        description: Version ID of the story's content when first added to a release.
      main_version_id:
        type: integer
        description: Version ID of the story's current content outside the release.
      stage:
        type: object
        description: Current workflow stage details.
        properties:
          workflow_id:
            type: integer
          workflow_stage_id:
            type: integer
          story_id:
            type: integer
          due_date:
            type: string
            format: date-time
          created_at:
            type: string
            format: date-time
```

**Key structural changes:**

1. **Content schema**: The base `story-base.yaml` references `story-content.yaml` (with typed field discriminators for asset, multilink, richtext, table, plugin). This replaces the simpler `blok.yaml` that only had `oneOf: [string, number, boolean, array<Blok>]`. The MAPI will now get the same rich content types as the CAPI. Verify that MAPI responses actually include the typed field shapes (they should — the underlying data is the same).

2. **Sub-object schemas**: `alternates`, `translated_slugs`, and `localized_paths` will now use the shared `$ref` types (`story-alternate.yaml`, `story-translated-slug.yaml`, `story-localized-path.yaml`) inherited from `story-base.yaml`.

   **Important**: The MAPI `translated_slugs` currently uses `story_id` + `slug` fields, while the shared `story-translated-slug.yaml` uses `path` + `lang`. Verify via the API which fields the MAPI actually returns. If both shapes exist, the shared spec may need updating, or MAPI may need its own translated slug type.

3. **Required fields**: `story-base.yaml` marks 20+ fields as required. These are appropriate for GET responses. The MAPI create/update request schemas (`story-create-request.yaml`, `story-update-request.yaml`) should NOT inherit these required constraints — they should remain separate schemas with their own required lists.

### 0.2.5 Replace `blok.yaml` with shared `story-content.yaml`

The MAPI's `blok.yaml` is a simplified version of the CAPI's `story-content.yaml`. Since story content has the same structure regardless of API (MAPI or CAPI), replace the MAPI `blok.yaml` reference with the shared `story-content.yaml`.

This gives MAPI consumers the same rich field-type discriminators (AssetField, MultilinkField, RichtextField, TableField, PluginField) that CAPI consumers already have.

Delete `packages/openapi/resources/mapi/stories/schemas/blok.yaml` after migration.

### 0.2.6 Update remaining MAPI resource specs

For all other MAPI resources (assets, components, datasources, etc.), scan for inline schemas that could reference shared types. Priority items:

- Any resource that defines pagination parameters should reference `shared/pagination.yaml` (after 0.2.3 alignment).
- Any resource that defines error responses should reference `shared/responses.yaml`.
- Path parameters should reference the aligned `shared/parameters.yaml` (after 0.2.1 investigation).

### 0.2.7 Rebuild bundled specs

After all spec changes, run Redocly to rebundle:

```sh
pnpm --filter @storyblok/openapi build
```

Verify no `$ref` resolution errors. Inspect the bundled `dist/mapi/*.yaml` files to confirm the `allOf` compositions are resolved correctly.

---

## 0.3 Align method naming via OpenAPI `operationId`

The generated SDK method names come directly from the `operationId` in the OpenAPI specs. Update these across all MAPI resource specs:

| Resource Spec | Current `operationId` | New `operationId` |
|---|---|---|
| `stories/main.yaml` | `list` | `getAll` |
| `stories/main.yaml` | `updateStory` | `update` |
| `assets/main.yaml` | `list` | `getAll` |
| `components/main.yaml` | `list` | `getAll` |
| `components/main.yaml` | `deleteComponent` | `delete` |
| `datasources/main.yaml` | `list` | `getAll` |
| `datasource_entries/main.yaml` | `list` | `getAll` |
| `datasource_entries/main.yaml` | `updateDatasourceEntry` | `update` |
| `presets/main.yaml` | `list` | `getAll` |
| `internal_tags/main.yaml` | `list` | `getAll` |
| `spaces/main.yaml` | `list` | `getAll` |
| `component_folders/main.yaml` | `list` | `getAll` |
| `asset_folders/main.yaml` | `list` | `getAll` |

After updating, regenerate the SDK to verify the new method names propagate correctly:

```sh
pnpm --filter @storyblok/management-api-client generate
```

The generated type names will also change correspondingly (e.g., `ListData` → `GetAllData`, `ListResponses` → `GetAllResponses`, etc.).

---

## 0.4 Switch to the hey-api generated client (exactly like CAPI)

The goal is to arrive at the same architecture as the CAPI client. The `@hey-api/client-ky` plugin generates the full HTTP client — there is no hand-written ky setup. Follow `packages/capi-client/scripts/generate.ts` exactly as the reference.

### 0.4.1 Update dependencies

```json
{
  "dependencies": {
    "@storyblok/region-helper": "workspace:*",
    "ky": "^1.14.3"
  }
}
```

`ky` is the only new runtime dependency. `@hey-api/client-ky` is a codegen plugin (devDependency only) — it generates code that imports `ky` directly, exactly as in the CAPI.

### 0.4.2 Update `generate.ts` to use `@hey-api/client-ky`

Replace the current `@hey-api/client-fetch` plugin with `@hey-api/client-ky` in `packages/mapi-client/generate.ts`. The generated `client/` directories (`client.gen.ts`, `types.gen.ts`, `utils.gen.ts`) will then be ky-backed, identical in structure to the CAPI's generated client. Reference `packages/capi-client/scripts/generate.ts` for the exact plugin list.

### 0.4.3 Delete the hand-written client

Remove the entire hand-written `packages/mapi-client/src/client/` directory:
- `client.ts` — replaced by the generated client
- `calculate-retry-delay.ts` — retry/backoff is handled by the generated client's config
- Related test files

Keep `error.ts` (`ClientError` class) — move it alongside `src/index.ts` since it's part of the public API, not the transport layer.

### 0.4.4 Wire the generated client in `src/index.ts`

Follow the CAPI's `src/index.ts` pattern exactly: call the generated `createClient(createConfig({ ... }))` to obtain a `Client` instance, then pass it explicitly to every SDK function via the `{ client }` option. Never use the module-level singleton client that hey-api also generates.

MAPI-specific config to pass into `createConfig`:

- **`retry`**: Increase retry limit beyond the CAPI default — the management API has stricter per-plan rate limits. Include all HTTP methods in retry (unlike CAPI which only retries safe methods), since 429 retry is safe regardless of method for the MAPI use case.
- **`timeout`**: Add a request timeout (MAPI currently has none).
- **Auth**: Inject the personal access token or OAuth bearer token via the `security` config array (same pattern as CAPI's `apiKey` injection).
- **Region**: Resolve the base URL from `space_id` via `@storyblok/region-helper` before creating the config (same as CAPI).

### 0.4.5 Preventive rate limiting (required)

Retry-on-429 alone is not sufficient — by the time a 429 is received, rate limit budget has already been spent and latency has been added. The MAPI client must include **preventive concurrency throttling** before requests are dispatched, exactly as the CAPI does in `src/index.ts` via `throttleManager.execute()`.

**Copy** the generic parts of `packages/capi-client/src/rate-limit.ts` directly into the MAPI client — do not create a shared package (the reusable surface is ~40 lines; extract to `@storyblok/api-utils` only if a third API client is ever needed):

1. **`createThrottle(limit)`** — The token-bucket concurrency limiter. Fully generic, copy as-is.
2. **`parseRateLimitPolicyHeader(response)`** — Parses the `X-RateLimit-Policy` header. Same format for MAPI and CAPI, copy as-is.
3. **`createThrottleManager(config)`** — Adapt for MAPI: **one single bucket, no tiers**. The CAPI's `determineTier()` logic (which inspects paths like `/v2/cdn/stories/...` and `per_page` thresholds) is CAPI-specific and must not be carried over. The MAPI has a flat rate limit per plan — default `maxConcurrent: 6`, adjustable via config, with optional `adaptToServerHeaders` to update the limit dynamically from `X-RateLimit-Policy`.

The throttle integrates at the same level as in the CAPI — wrapping the `requestNetwork` call in `throttleManager.execute()`, and feeding responses back via `throttleManager.adaptToResponse()`. Retry remains configured as a last-resort safety net.

---

## 0.5 Switch to factory function pattern

Replace the class-based `ManagementApiClient` with a factory function `createManagementApiClient(config)` that returns a plain object.

### 0.5.1 New public API shape

```ts
import { createManagementApiClient } from '@storyblok/management-api-client';

const client = createManagementApiClient({
  accessToken: '...', // or { oauthToken: '...' }
  region: 'eu',
  // Optional:
  throwOnError: true,
  retry: { limit: 12, backoffLimit: 20_000 },
  timeout: 30_000,
  rateLimit: {
    maxConcurrent: 6,           // default; tune to your plan's limit
    adaptToServerHeaders: true,  // default; adjusts dynamically via X-RateLimit-Policy
  },
});
```

**Config changes:**
- Replace `token: { accessToken } | { oauthToken }` with a simpler `accessToken: string` or `oauthToken: string` top-level field (align with CAPI's `accessToken` pattern). If both token types must be supported, keep the current approach but consider simplifying.
- Add `retry`, `timeout`, and `rateLimit` to the config type (currently hardcoded).

### 0.5.2 Replace SDK registry with explicit composition

The current `sdkRegistry` pattern lazily instantiates class-based SDK instances via `Object.defineProperty`. Replace with the CAPI's explicit composition pattern: call the generated `createClient(createConfig({ ... }))` once, then pass the resulting `client` instance explicitly to every generated SDK function via the `{ client }` option.

Follow `packages/capi-client/src/index.ts` as the reference. The MAPI equivalent will be structurally identical — one `Client` instance shared across all resource namespaces, with throttling and auth layered on top in `requestNetwork`.

### 0.5.3 Update exports

`src/index.ts` becomes the single composition root (exactly as in the CAPI). Everything — factory function, config type, error class, re-exported generated types — is exported from there. Follow the CAPI's `src/index.ts` export structure as the reference.

---

## 0.6 Update tests

### 0.6.1 Update integration tests

`packages/mapi-client/src/__tests__/integration.test.ts` will need updates for:
- Factory function instantiation instead of `new ManagementApiClient(...)`.
- Renamed methods (`list` → `getAll`, `updateStory` → `update`, etc.).
- New type names in assertions.

### 0.6.2 Update or replace retry/throttle tests

Tests for the custom `calculateRetryDelay` and `executeWithRetry` should be replaced with tests that verify the generated client's retry configuration and the throttle manager behavior (e.g., mock server returning 429, verify retry; saturate concurrency limit, verify queuing).

### 0.6.3 Add type-level tests

Add `expectTypeOf` tests verifying:
- Generated types reflect shared base (e.g., `Story` type includes fields from `story-base.yaml`).
- Method signatures match expected patterns (`getAll`, `get`, `create`, `update`, `delete`).
- Return types are correct discriminated unions.

---

## 0.7 Verify and validate types against real API

After regenerating types from the updated specs, validate them against real MAPI responses.

Use the `qa-engineer-manual` skill to:

1. **Query the MAPI** for a story and compare the response shape against the generated `Story` type. Specifically check:
   - Are the new fields from the official docs actually present (`user_ids`, `space_role_ids`, `release_ids`, `current_version_id`, `base_version_id`, `main_version_id`, `stage`)?
   - Does `translated_slugs` use `path` (shared spec) or `story_id` + `slug` (current MAPI spec)?
   - Does `content` include typed field values (AssetField shape, etc.) or just raw primitives?
   - Are the `required` fields from `story-base.yaml` actually always present in MAPI responses?

2. **Verify parameter types**: Send requests with string space IDs vs integer space IDs to confirm which is accepted.

3. **Verify pagination max**: Send a request with `per_page=200` to see if it's capped at 100 or if MAPI allows higher values.

Adjust the OpenAPI specs based on findings before finalizing.

---

## Key design decisions

### Why the hey-api generated client + preventive throttling

The MAPI client currently has a hand-written fetch wrapper and relies entirely on retry-after-429 for rate limiting. This is insufficient — retry means you're already hitting rate limits, wasting round trips, and degrading performance under concurrent load.

Adopting the same `@hey-api/client-ky`-generated client as the CAPI (with a copied token-bucket throttle) provides:
- **Preventive rate limiting** — Caps concurrent requests *before* 429s occur. Retry remains as a last-resort safety net.
- Battle-tested retry across multiple status codes (vs MAPI's current 429-only).
- Built-in timeout (MAPI currently has none).
- `Retry-After` and `X-RateLimit-Policy` header handling.
- Less custom code to maintain — the transport layer is generated, not hand-written.
- Full consistency with the CAPI client architecture.

### Why factory function over class

- **Consistency with CAPI**: `createApiClient()` and `createManagementApiClient()` are a natural pair.
- **Simpler composition**: No class inheritance, no `Object.defineProperty` lazy evaluation, no SDK registry.
- **Tree-shaking friendly**: Plain objects with function properties are easier for bundlers to analyze.
- **Testing**: Factory functions are trivially mockable without class instantiation.

### Why `getAll` over `list`

- CAPI already uses `getAll`. Cross-client consistency means developers learn one pattern.
- `getAll` is descriptive — it fetches all (paginated) records. `list` is ambiguous (does it return a list? or list something?).
- This is a breaking change for `@storyblok/management-api-client` 0.x consumers, which is acceptable pre-1.0.

### Why include missing story fields

The official Storyblok MAPI documentation lists fields (`user_ids`, `space_role_ids`, `release_ids`, `current_version_id`, `base_version_id`, `main_version_id`, `stage`) that are not in the current OpenAPI spec. Including them ensures the generated types match what the API actually returns, preventing consumers from needing `as unknown as ...` casts.

### `required` field strategy for MAPI stories

`story-base.yaml` marks 20+ fields as required (appropriate for GET responses). MAPI has separate request schemas for create (`story-create-request.yaml`) and update (`story-update-request.yaml`) where most fields are optional. The `allOf` composition only applies to the response `Story` type, not to request bodies. This preserves the distinction.

---

## 0.8 Update the CLI consumer (`packages/cli`)

`packages/cli` (`storyblok` package) is the primary consumer of `@storyblok/management-api-client`. It depends on `workspace:*` so its build breaks whenever the MAPI client's public API changes. All CLI changes required by this task must be part of the same PR as the MAPI client changes.

### 0.8.1 Replace class instantiation with factory function

`packages/cli/src/api.ts` currently instantiates the MAPI client via `new ManagementApiClient(options)`. Replace with:

```ts
import { createManagementApiClient, type ManagementApiClientConfig } from '@storyblok/management-api-client';

// ...

export function creategetMapiClient(options: ManagementApiClientConfig) {
  const client = createManagementApiClient(options);
  // rate limiting now built-in — see 0.8.2
  return client;
}
```

### 0.8.2 Remove the CLI's hand-rolled rate limiter

`api.ts` currently uses `async-sema`'s `RateLimit` to apply a concurrency cap via a `requestInterceptor`. After this task the MAPI client has built-in preventive throttling (`maxConcurrent: 6` by default, configurable). The CLI's own limiter becomes redundant and should be removed.

- Delete the `applyRateLimit` function and `resolveLimiter` helper from `api.ts`.
- Remove the `async-sema` dependency from `packages/cli/package.json` **if** it is no longer used anywhere else in the CLI. Check with `grep -r 'async-sema' packages/cli/src` before removing.
- Pass the desired concurrency via the new `rateLimit.maxConcurrent` config key instead:

```ts
const client = createManagementApiClient({
  accessToken: options.accessToken,
  region: options.region,
  rateLimit: {
    maxConcurrent: getActiveConfig().api.maxConcurrency,
  },
});
```

### 0.8.3 Update `ManagementApiClientConfig` usage

The config shape changes (see task 0.5.1). Update all call sites in the CLI:

| Old | New |
|---|---|
| `token: { accessToken }` | `accessToken` (top-level) |
| `token: { oauthToken }` | `oauthToken` (top-level) |

Affected files include `api.ts` and `program.ts` (the config is assembled there and passed down).

### 0.8.4 Update method call sites

Method names change across the CLI wherever it calls MAPI SDK methods:

| Old | New |
|---|---|
| `client.stories.list(...)` | `client.stories.getAll(...)` |
| `client.stories.updateStory(...)` | `client.stories.update(...)` |
| `client.datasources.list(...)` | `client.datasources.getAll(...)` |
| `client.datasourceEntries.list(...)` | `client.datasourceEntries.getAll(...)` |
| `client.components.list(...)` | `client.components.getAll(...)` |
| `client.spaces.list(...)` | `client.spaces.getAll(...)` |
| `client.assetFolders.list(...)` | `client.assetFolders.getAll(...)` |
| `client.assets.list(...)` | `client.assets.getAll(...)` |

Run `grep -rn '\.list(' packages/cli/src` to find all call sites. The TypeScript compiler will flag any you miss after updating the dependency.

### 0.8.5 Update type imports

The deep sub-path imports (`@storyblok/management-api-client/resources/stories`, etc.) may change depending on how the new client structures its exports. Update import paths if needed. Prefer importing from the package root (`@storyblok/management-api-client`) when the types are re-exported there.

Verify the CLI still compiles and all tests pass:

```sh
pnpm --filter storyblok test:types
pnpm --filter storyblok test:ci
pnpm --filter storyblok lint
```

---

## 0.9 Write an upgrade guide in the README ✅ DONE

Update `packages/mapi-client/README.md` to include a **Migration Guide** section that covers all breaking changes introduced by this task. Consumers of `@storyblok/management-api-client` need a clear, concise guide to update their code.

The upgrade guide must cover:

### Factory function (breaking)

```ts
// Before
import { ManagementApiClient } from '@storyblok/management-api-client';
const client = new ManagementApiClient({ token: { accessToken: 'your-token' } });

// After
import { createManagementApiClient } from '@storyblok/management-api-client';
const client = createManagementApiClient({ accessToken: 'your-token' });
```

### Config shape (breaking)

```ts
// Before
new ManagementApiClient({ token: { accessToken: '...' } });
new ManagementApiClient({ token: { oauthToken: '...' } });

// After
createManagementApiClient({ accessToken: '...' });
createManagementApiClient({ oauthToken: '...' });
```

### Renamed methods (breaking)

| Before | After |
|---|---|
| `client.stories.list(...)` | `client.stories.getAll(...)` |
| `client.stories.updateStory(...)` | `client.stories.update(...)` |
| `client.components.list(...)` | `client.components.getAll(...)` |
| `client.components.deleteComponent(...)` | `client.components.delete(...)` |
| `client.datasources.list(...)` | `client.datasources.getAll(...)` |
| `client.datasourceEntries.list(...)` | `client.datasourceEntries.getAll(...)` |
| `client.datasourceEntries.updateDatasourceEntry(...)` | `client.datasourceEntries.update(...)` |
| `client.spaces.list(...)` | `client.spaces.getAll(...)` |
| `client.assets.list(...)` | `client.assets.getAll(...)` |
| `client.assetFolders.list(...)` | `client.assetFolders.getAll(...)` |
| `client.presets.list(...)` | `client.presets.getAll(...)` |
| `client.internalTags.list(...)` | `client.internalTags.getAll(...)` |
| `client.componentFolders.list(...)` | `client.componentFolders.getAll(...)` |

### Removed runtime config mutation (breaking)

`client.setConfig()` and `client.setToken()` are removed — these were tied to the class instance. Create a new client instance instead:

```ts
// Before
client.setToken({ accessToken: 'new-token' });

// After
const newClient = createManagementApiClient({ accessToken: 'new-token' });
```

### Rate limiting (non-breaking, but note)

The client now includes built-in preventive throttling. If you were applying your own concurrency limiter via a request interceptor, remove it to avoid double-throttling. Configure the built-in limit via the `rateLimit` option:

```ts
createManagementApiClient({
  accessToken: 'your-token',
  rateLimit: { maxConcurrent: 3 }, // default: 6
});
```

The README update should also refresh the **Quick Start**, **Authentication**, **Configuration**, and **Available Resources** sections to reflect the new API surface — these sections currently show the old class-based API.

---

## Dependency

This task has no dependencies on Parts 1–5 — it can be executed independently and in parallel. However, it does affect:
- **Part 1** (`generate.ts` in `@storyblok/schema`): After this task, the MAPI YAML specs in `@storyblok/openapi` will have different structures. The schema package's code generation should be verified against the new bundled output.
- **Part 2** (moving OpenAPI package): The spec file paths and structure may change slightly. Coordinate file moves.
- **Part 5** (integrating types in CAPI): The shared story types will now be used by both MAPI and CAPI, making the type integration more natural.
- **`packages/cli`**: The CLI is a `workspace:*` consumer and must be updated in the same PR (see task 0.8). The CLI's own rate-limiter (`async-sema`) can be removed after this task.
