# Cleanup 01: Deduplicate ClientError and Rate-Limit Primitives

`packages/mapi-client` contains byte-for-byte copies of `ClientError` and the core
rate-limit primitives (`createThrottle`, `parseRateLimitPolicyHeader`) that already
live in `packages/capi-client`. Deduplication removes the maintenance burden and
ensures consumers of both packages receive the same `ClientError` class, so
`instanceof` checks work correctly across packages.

## Acceptance criteria

- `packages/mapi-client/src/error.ts` is replaced by a single re-export from
  `@storyblok/api-client`.
- `packages/mapi-client/src/rate-limit.ts` imports `createThrottle` and
  `parseRateLimitPolicyHeader` from `@storyblok/api-client` instead of
  re-defining them.
- `@storyblok/api-client` is added as a `workspace:*` dependency of
  `@storyblok/management-api-client`.
- All exports of `ClientError` and `RateLimitConfig` from both packages remain
  unchanged (consumers are not affected).
- `pnpm --filter @storyblok/management-api-client build` succeeds.
- `pnpm --filter @storyblok/management-api-client test:ci` passes.
- `pnpm --filter @storyblok/management-api-client lint` passes.
- `pnpm --filter @storyblok/management-api-client typecheck` passes.

---

## Context

### ClientError

`packages/capi-client/src/error.ts` and `packages/mapi-client/src/error.ts` are
character-for-character identical (modulo the JSDoc comment). Both are currently
exported from their respective package roots as `ClientError`.

Because the two classes are separate runtime identities, a value created by one
package fails `instanceof` checks against the class imported from the other. The
CLI already works around this with duck-typing (`error?.response?.status`), but
any future consumer that imports `ClientError` from one package and catches errors
from the other will be silently surprised.

### Rate-limit primitives

`createThrottle` (token-bucket implementation, ~30 lines) and
`parseRateLimitPolicyHeader` (~10 lines) are identical between the two packages.
The higher-level `createThrottleManager` intentionally differs: capi-client uses
four tier-aware buckets, mapi-client uses one flat bucket. Only the
lower-level primitives need to be shared.

---

## 1. Add `@storyblok/api-client` as a dependency of `mapi-client`

In `packages/mapi-client/package.json`, add to `dependencies`:

```json
"@storyblok/api-client": "workspace:*"
```

---

## 2. Export shared primitives from `capi-client`

### 2.1 Export `ClientError`

`packages/capi-client/src/index.ts` already exports `ClientError`. No change needed.

### 2.2 Export `createThrottle` and `parseRateLimitPolicyHeader`

`createThrottle` is currently a private function (not exported) in
`packages/capi-client/src/rate-limit.ts`. Export it:

```ts
// packages/capi-client/src/rate-limit.ts
export function createThrottle(initialLimit: number, intervalMs = DEFAULT_INTERVAL_MS): Throttle {
  // ... existing implementation unchanged
}
```

`parseRateLimitPolicyHeader` is already exported. No change needed.

Then re-export both from `packages/capi-client/src/index.ts` so they are part of
the package's public API:

```ts
export { createThrottle, parseRateLimitPolicyHeader } from './rate-limit';
```

---

## 3. Replace `mapi-client/src/error.ts` with a re-export

Replace the entire file content with:

```ts
export { ClientError } from '@storyblok/api-client';
```

The import in `packages/mapi-client/src/index.ts` already uses:
```ts
import { ClientError } from './error';
```
...so no change is needed there — it will now transitively re-export from
`@storyblok/api-client`.

---

## 4. Replace duplicated primitives in `mapi-client/src/rate-limit.ts`

Import the shared primitives instead of re-defining them. The private `Throttle`
interface and the two functions (`createThrottle`, `parseRateLimitPolicyHeader`)
can be removed and replaced with imports:

```ts
import { createThrottle, parseRateLimitPolicyHeader } from '@storyblok/api-client';
```

`MAX_RATE_LIMIT` and `DEFAULT_INTERVAL_MS` are used only inside `createThrottle`
(which now lives in capi-client) and inside `parseRateLimitPolicyHeader` (same).
Remove those constants from mapi-client since they are no longer needed locally.

`DEFAULT_MAX_CONCURRENT = 6` and `RateLimitConfig`, `ThrottleManager`, and
`createThrottleManager` remain entirely in mapi-client — only the shared building
blocks move.

---

## 5. Verify nx build order

The nx `build` target in `packages/mapi-client/package.json` currently lists
`"^build"` as a dependency (meaning all workspace dependencies must build first).
Adding `@storyblok/api-client` as a `workspace:*` dependency automatically causes
nx to build it before building mapi-client. No nx config change is needed.

---

## 6. Run checks

```sh
pnpm --filter @storyblok/api-client build
pnpm --filter @storyblok/management-api-client build
pnpm --filter @storyblok/management-api-client test:ci
pnpm --filter @storyblok/management-api-client lint
pnpm --filter @storyblok/management-api-client typecheck
```
