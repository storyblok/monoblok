# Cleanup 03: Align CLI with mapi-client API

The `packages/cli` consumer was not updated when `packages/mapi-client` was
refactored in task 00. Every CLI command that calls the mapi-client still uses the
old API shape (`path: { space_id }` per-call, per-request `throwOnError`, flat
options object). The new mapi-client injects `spaceId` at construction time and
uses positional method signatures. The CLI does not compile correctly against the
new mapi-client.

## Acceptance criteria

- `pnpm --filter storyblok test:types` passes (no TypeScript errors).
- `pnpm --filter storyblok test:ci` passes.
- `pnpm --filter storyblok lint` passes.
- Every CLI command that calls the mapi-client uses the new resource method
  signatures (no `path:`, no per-request `throwOnError`).
- `getMapiClient()` / `creategetMapiClient()` in `api.ts` are updated to the
  per-config-singleton pattern described below.

---

## Context

### New mapi-client API (resource method signatures)

The refactored mapi-client injects `spaceId` at construction time.
Resource methods no longer accept a `path` parameter:

| Old CLI call | New call |
|---|---|
| `client.stories.getAll({ path: { space_id }, query, throwOnError })` | `client.stories.getAll({ query })` |
| `client.stories.get({ path: { space_id, story_id }, throwOnError })` | `client.stories.get(storyId)` |
| `client.stories.create({ path: { space_id }, body, throwOnError })` | `client.stories.create(body)` |
| `client.stories.update({ path: { space_id, story_id }, body, throwOnError })` | `client.stories.update(storyId, body)` |
| `client.stories.remove({ path: { space_id, story_id } })` | `client.stories.remove(storyId)` |
| `client.components.getAll({ path: { space_id }, query })` | `client.components.getAll({ query })` |
| `client.components.create({ path: { space_id }, body })` | `client.components.create(body)` |
| `client.components.update({ path: { space_id, component_id }, body })` | `client.components.update(componentId, body)` |
| `client.componentFolders.create({ path: { space_id }, body })` | `client.componentFolders.create(body)` |
| `client.componentFolders.update({ path: { space_id, component_group_id }, body })` | `client.componentFolders.update(groupId, body)` |
| `client.presets.create({ path: { space_id }, body })` | `client.presets.create(body)` |
| `client.presets.update({ path: { space_id, preset_id }, body })` | `client.presets.update(presetId, body)` |
| `client.internalTags.create({ path: { space_id }, body })` | `client.internalTags.create(body)` |
| `client.internalTags.update({ path: { space_id, internal_tag_id }, body })` | `client.internalTags.update(tagId, body)` |
| `client.assets.getAll({ path: { space_id }, query })` | `client.assets.getAll({ query })` |
| `client.assets.get({ path: { space_id, asset_id } })` | `client.assets.get(assetId)` |
| `client.assets.update({ path: { space_id, asset_id }, body })` | `client.assets.update(assetId, body)` |
| `client.assetFolders.getAll({ path: { space_id }, query })` | `client.assetFolders.getAll({ query })` |
| `client.assetFolders.get({ path: { space_id, asset_folder_id } })` | `client.assetFolders.get(folderId)` |
| `client.assetFolders.create({ path: { space_id }, body })` | `client.assetFolders.create(body)` |
| `client.assetFolders.update({ path: { space_id, asset_folder_id }, body })` | `client.assetFolders.update(folderId, body)` |
| `client.datasources.getAll({ path: { space_id }, query })` | `client.datasources.getAll({ query })` |
| `client.datasources.create({ path: { space_id }, body })` | `client.datasources.create(body)` |
| `client.datasources.update({ path: { space_id, datasource_id }, body })` | `client.datasources.update(datasourceId, body)` |
| `client.datasourceEntries.getAll({ path: { space_id }, query })` | `client.datasourceEntries.getAll({ query })` |
| `client.datasourceEntries.create({ path: { space_id }, body })` | `client.datasourceEntries.create(body)` |
| `client.datasourceEntries.update({ path: { space_id, entry_id }, body })` | `client.datasourceEntries.update(entryId, body)` |
| `client.datasources.remove({ path: { space_id, datasource_id } })` | `client.datasources.remove(datasourceId)` |
| `client.spaces.get({ path: { space_id } })` | `client.spaces.get()` |
| `client.spaces.create({ body: { space } })` | `client.spaces.create({ space })` |

`throwOnError` is now a constructor-level option (set when the client is created),
not a per-request option. The CLI should set `throwOnError: true` at construction
time (since all CLI operations want errors thrown). Remove all per-request
`throwOnError: true` options from call sites.

`users.me()` does not require a `spaceId` — the `users` resource intentionally
omits it.

### The `spaceId` problem

`ManagementApiClientConfig.spaceId` is required. The CLI resolves the space ID
per-command from the `--space` CLI flag, not at client initialization time. The
client is currently initialized once in `preAction` (in `program.ts`) with only
`accessToken` and `region`.

Solution: **Map-based singleton** — `api.ts` caches one client instance per
unique serialized config key. The client for `users.me()` (no spaceId) is separate
from space-scoped clients.

---

## 1. Update `packages/cli/src/api.ts`

Replace the single-instance singleton with a Map-based approach:

```ts
import { createManagementApiClient, type ManagementApiClientConfig } from '@storyblok/management-api-client';
import { getActiveConfig } from './lib/config';

type MapiClient = ReturnType<typeof createManagementApiClient>;
type AuthConfig = { accessToken?: string; oauthToken?: string; region?: string };

// Per-config singleton cache keyed by JSON-serialized config
const clientCache = new Map<string, MapiClient>();
let defaultAuth: AuthConfig | null = null;

function buildClientOptions(options: ManagementApiClientConfig): ManagementApiClientConfig {
  const { api } = getActiveConfig();
  return {
    throwOnError: true,
    rateLimit: api.maxConcurrency > 0 ? { maxConcurrent: api.maxConcurrency } : false,
    ...options,
  };
}

/**
 * Store authentication defaults from the preAction hook.
 * Call this once at startup before any space-scoped calls.
 */
export function setMapiAuthDefaults(auth: AuthConfig): void {
  defaultAuth = auth;
}

/**
 * Returns a cached mapi-client for the given spaceId, creating one if needed.
 * Merges stored auth defaults with the provided spaceId.
 */
export function getMapiClientForSpace(spaceId: number): MapiClient {
  if (!defaultAuth) {
    throw new Error('MAPI auth not initialized. Call setMapiAuthDefaults first.');
  }
  const config = buildClientOptions({ ...defaultAuth, spaceId });
  const key = JSON.stringify(config);
  if (!clientCache.has(key)) {
    clientCache.set(key, createManagementApiClient(config));
  }
  return clientCache.get(key)!;
}

/**
 * Creates a standalone client (not cached). Used for operations that don't
 * require a spaceId, such as users.me() during login.
 *
 * NOTE: spaceId is required by the config type but unused by the `users`
 * resource. Pass 0 as a placeholder.
 */
export function creategetMapiClient(options: ManagementApiClientConfig): MapiClient {
  return createManagementApiClient(buildClientOptions(options));
}

/**
 * @deprecated Use getMapiClientForSpace(spaceId) instead.
 * Kept temporarily for compatibility during migration.
 */
export function getMapiClient(): MapiClient {
  throw new Error('getMapiClient() is deprecated. Use getMapiClientForSpace(spaceId) instead.');
}
```

The `creategetMapiClient` function is kept for `user/actions.ts` which needs a
no-spaceId client. Since `ManagementApiClientConfig.spaceId` is `number` (required),
pass `0` as a placeholder — the `users` resource ignores it.

---

## 2. Update `packages/cli/src/program.ts`

Replace the `getMapiClient({ accessToken, region })` call in the `preAction` hook
with `setMapiAuthDefaults(...)`:

```ts
// Before
getMapiClient({
  accessToken: state.password,
  region: state.region ?? resolvedConfig.region,
});

// After
setMapiAuthDefaults({
  accessToken: state.password,
  region: state.region ?? resolvedConfig.region,
});
```

Update the import: replace `getMapiClient` with `setMapiAuthDefaults`.

---

## 3. Update CLI command action files

For each action file below, replace `getMapiClient()` with
`getMapiClientForSpace(Number(spaceId))` and update all call sites to the new
method signatures. Remove all `throwOnError: true` from individual calls (it is
now set at construction time via `buildClientOptions`).

### `packages/cli/src/commands/stories/actions.ts`

- `fetchStories(spaceId, params)`:
  - `const client = getMapiClientForSpace(Number(spaceId))`
  - `client.stories.getAll({ query: { ...params, per_page: ..., page: ... } })`
- `fetchStory(spaceId, storyId)`:
  - `const client = getMapiClientForSpace(Number(spaceId))`
  - `client.stories.get(storyId)`
- `createStory(spaceId, payload)`:
  - `const client = getMapiClientForSpace(Number(spaceId))`
  - `client.stories.create({ story: payload.story, ...(payload.publish ? { publish: payload.publish } : {}) })`
- `updateStory(spaceId, storyId, payload)`:
  - `const client = getMapiClientForSpace(Number(spaceId))`
  - `client.stories.update(storyId, { story: payload.story, force_update: ..., ... })`

### `packages/cli/src/commands/stories/streams.ts`

Find and update all `getMapiClient().stories.*` calls to use
`getMapiClientForSpace(spaceId).stories.*`. The `spaceId` should be available from
the stream's context/options.

### `packages/cli/src/commands/components/pull/actions.ts`

Update all calls:
- `fetchComponents(spaceId)` → `getMapiClientForSpace(Number(spaceId))`, then
  `client.components.getAll()`
- `fetchComponentGroups(spaceId)` → `client.componentFolders.getAll()`
- `fetchPresets(spaceId)` → `client.presets.getAll()`
- `fetchInternalTags(spaceId)` → `client.internalTags.getAll()`

### `packages/cli/src/commands/components/push/actions.ts`

Update all calls to remove `path:` and use positional IDs:
- `pushComponent(space, component)` → `client.components.create({ component })`
- `updateComponent(space, componentId, component)` → `client.components.update(componentId, { component })`
- `pushComponentGroup(space, group)` → `client.componentFolders.create({ component_group: group })`
- `updateComponentGroup(space, groupId, group)` → `client.componentFolders.update(String(groupId), { component_group: group })`
- `pushComponentPreset(space, preset)` → `client.presets.create({ preset })`
- `updateComponentPreset(space, presetId, preset)` → `client.presets.update(presetId, { preset })`
- `pushComponentInternalTag(space, tag)` → `client.internalTags.create(tag)`
- `updateComponentInternalTag(space, tagId, tag)` → `client.internalTags.update(tagId, tag)`

### `packages/cli/src/commands/assets/actions.ts`

- `fetchAssets({ spaceId, params })` → `getMapiClientForSpace(Number(spaceId))`, then
  `client.assets.getAll({ query: { ...params, ... } })`
- `fetchAsset(spaceId, assetId)` → `client.assets.get(assetId)`
- `updateAsset(spaceId, assetId, body)` → `client.assets.update(assetId, body)`
- `fetchAssetFolders(spaceId)` → `client.assetFolders.getAll()`
- `createAssetFolder(spaceId, body)` → `client.assetFolders.create(body)`
- `updateAssetFolder(spaceId, folderId, body)` → `client.assetFolders.update(folderId, body)`
- Asset upload/finalize calls: check the exact method signatures in
  `packages/mapi-client/src/resources/assets.ts` and align.

### `packages/cli/src/commands/assets/streams.ts`

Update all `getMapiClient().assetFolders.*` and `getMapiClient().assets.*` calls.
The spaceId should already be available from the stream context.

### `packages/cli/src/commands/datasources/pull/actions.ts`

- `fetchDatasources(spaceId)` → `getMapiClientForSpace(Number(spaceId))`, then
  `client.datasources.getAll()`
- `fetchDatasourceEntries(spaceId, datasourceId)` → `client.datasourceEntries.getAll({ query: ... })`

### `packages/cli/src/commands/datasources/push/actions.ts`

- `createDatasource(spaceId, body)` → `client.datasources.create(body)`
- `updateDatasource(spaceId, id, body)` → `client.datasources.update(id, body)`
- `createDatasourceEntry(spaceId, body)` → `client.datasourceEntries.create(body)`
- `updateDatasourceEntry(spaceId, id, body)` → `client.datasourceEntries.update(id, body)`

### `packages/cli/src/commands/datasources/delete/actions.ts`

- `deleteDatasource(spaceId, id)` → `client.datasources.remove(id)`

### `packages/cli/src/commands/spaces/actions.ts`

- `fetchSpace(spaceId)`:
  - `const client = getMapiClientForSpace(Number(spaceId))`
  - `client.spaces.get()` — no argument, spaceId comes from constructor
- `createSpace(space)`:
  - The `spaces.create()` resource method signature is `create(body, options?)`.
  - Check the generated types for the exact body shape — it should be
    `{ space: SpaceCreateRequest }` or just `SpaceCreateRequest` directly.

### `packages/cli/src/commands/user/actions.ts`

The `getUser` function needs a no-spaceId client. Use `creategetMapiClient` with
`spaceId: 0` as placeholder (the `users` resource ignores it):

```ts
const client = creategetMapiClient({
  accessToken: token,
  region,
  spaceId: 0,  // placeholder — users resource doesn't use spaceId
});
const { data, error, response } = await client.users.me();
```

---

## 4. Update mapi-client test files

The mapi-client's own test files also use the old API. Update them to use the new
method signatures. These are in:
- `packages/mapi-client/src/stories.test.ts`
- `packages/mapi-client/src/assets.test.ts`
- `packages/mapi-client/src/components.test.ts`
- `packages/mapi-client/src/spaces.test.ts`
- (and any others flagged by `pnpm --filter @storyblok/management-api-client test:ci`)

---

## 5. Minor cleanup

While touching these files, fix the following:

- **Remove dead `?? {}`** in `packages/capi-client/src/resources/datasources.ts:34`.
  The `query` variable is already defaulted to `{}` on the line above.

- **Align `console.log` vs `console.warn`** in generate scripts:
  `packages/capi-client/scripts/generate.ts` uses `console.log` for progress
  messages; `packages/mapi-client/generate.ts` uses `console.warn`. Align to
  `console.log` in both (warnings imply problems; progress messages are not warnings).

- **Remove extra blank line** in `packages/cli/src/commands/components/push/index.ts`
  where `console.log(\`${requestCount} requests made\`)` was removed.

---

## 6. Run all checks

```sh
pnpm --filter @storyblok/management-api-client test:ci
pnpm --filter @storyblok/management-api-client typecheck
pnpm --filter storyblok test:types
pnpm --filter storyblok test:ci
pnpm --filter storyblok lint
```
