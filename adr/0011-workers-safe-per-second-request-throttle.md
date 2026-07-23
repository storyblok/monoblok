# ADR-0011: Workers-Safe Per-Second Request Throttle

**Status:** Accepted
**Date:** 2026-07-23

## Context

The Storyblok API clients (`storyblok-js-client`, `@storyblok/api-client` (capi), `@storyblok/management-api-client` (mapi)) throttle outgoing requests to stay under the server's rate limits. Two of them released a throttle slot from a fire-and-forget `setTimeout`: `storyblok-js-client` decremented its in-flight count inside a `setTimeout(interval)` callback, and `mapi` used `async-sema`'s `RateLimit`, which releases its token from a `setTimeout(delay)`. On Cloudflare Workers (and comparable edge runtimes such as miniflare and Shopify Oxygen) the isolate suspends once a response is sent and drops any timer that has not yet fired. Because the client is a cross-request singleton (`@storyblok/astro` stores it on `globalThis`, and the React/Hydrogen integrations follow the same pattern), the dropped release leaked the in-flight count across requests until the throttle wedged, SSR handlers hung, and Cloudflare returned `1101`. Reported in #533 (Astro), #319 and #353 (Hydrogen/Oxygen), and previously in the archived js-client issue #682.

The `capi` client did not have this hang: it released its slot on request completion (in the settled promise handler), not from a timer. It did, however, share the modeling bug described below.

The other relevant question is what the server actually limits. Verified against the backend (storyrails):

- The numbers the clients pace against are enforced as **requests per second**, in a fixed one-second window (a Redis counter keyed by the clock second, reset when the second rolls over). The 429 body literally reads "Rate limit of N request per second has been reached." CDN listing tiers are `per_page <= 25 -> 50`, `26-50 -> 15`, `51-75 -> 10`, `76-100 -> 6` per second; published/cached is `1000` per second; the Management API is `3` per second on the free plan and `6` on paid plans. The client tiers match these exactly.
- Separately, the backend also enforces a genuine **concurrency cap** (default 30 simultaneous in-flight requests per space), implemented as an around-action that increments before and decrements after each request. This is the only limit the `X-RateLimit-Policy: "space-concurrent-requests";q=N` header describes, and it is emitted only on `version=draft` requests.

The `capi` client conflated the two: it applied the per-second tier numbers as a concurrency cap. A concurrency limiter does not bound requests per second (N fast requests can all complete within one second and still trip the per-second limit), so it is the wrong model for these numbers and can increase 429s under bursty, fast-completing responses. `storyblok-js-client` and `mapi` already modeled a per-second (per-interval) limit; their defect was only the Workers-unsafe timer described above.

## Decision

Model the throttle as a **per-second sliding-window rate limiter**, and make its waiting **Workers-safe**.

1. **Per-second window.** At most `limit` calls may start within any rolling `interval` (default 1000ms). The window is a list of recent start timestamps, pruned against `Date.now()` on every attempt. A call that finds the window full waits until the oldest entry ages out, then retries.
2. **Workers-safe waiting.** The only timers scheduled are ones that resolve the promise the caller is already awaiting, so they run within the request lifecycle and are never orphaned. Window state is derived from wall-clock timestamps and self-heals by pruning, so nothing leaks across requests even in a shared singleton. This is the property the original design lacked: it released the slot from a detached timer that Workers could drop.
3. **Opt-out.** A non-positive or non-finite `limit` disables throttling and lets every call through.
4. **Server-side limits still apply.** The per-second window is preventive; the existing `429` retry-with-backoff path remains the backstop, including for the separate concurrency cap.
5. **Copied, not shared.** The same implementation lives as an independent copy in each of the three client packages rather than a shared workspace dependency, so the independently published packages stay decoupled and each can evolve without a cross-package runtime dependency.

## Alternatives Considered

- **Concurrency limiter** (cap simultaneous in-flight requests). Rejected: it models the wrong constraint. Capping in-flight requests does not bound requests per second, so it neither matches the backend's per-second tiers nor reliably prevents 429s.
- **Keep the fire-and-forget timer but rely on `ctx.waitUntil`.** Rejected: couples the client to a Workers-specific API and still races the isolate lifecycle.
- **Shared throttle package consumed by all three clients.** Rejected for now: it couples three independently versioned public packages through a shared runtime dependency. A small, well-tested copy in each package is preferred.
- **Also enforce the 30-request concurrency cap client-side.** Deferred: the per-second window is the dominant constraint for typical usage, and the concurrency cap is covered reactively by the 429 retry path. Adding a client-side concurrency limiter (driven by the draft `X-RateLimit-Policy` quota) can be a follow-up.

## Consequences

- **Requests are paced to the server's per-second budget** instead of an unrelated in-flight cap, which is the behavior the tier numbers were always meant to express. Bursts beyond the window wait rather than being sent and rejected.
- **No timer-driven state, so no leak or hang on Workers.** The suspend-after-response behavior can no longer wedge the throttle.
- **A non-positive or non-finite `limit` now means "no throttle"** rather than deadlocking or throwing.
- **`abort()` rejects waiting calls with an `AbortError` instance** and clears them; in-flight calls still settle.
- **Three copies to keep in sync.** A change to the limiter must be applied to `storyblok-js-client`, `@storyblok/api-client`, and `@storyblok/management-api-client`. This is an accepted maintenance cost in exchange for package decoupling; the ADR and matching tests in each package document the shared contract.
- **`async-sema` is dropped from the Management API client**, which used its `RateLimit` (a fire-and-forget token release, unsafe on Workers) for throttling.
