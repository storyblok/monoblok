# ADR-0011: Concurrency-Limited Request Throttle

**Status:** Accepted
**Date:** 2026-07-23

## Context

`storyblok-js-client` throttles outgoing requests through a per-rate-limit queue (`throttlePromise.ts`, managed by `throttleQueueManager.ts`). The original implementation was a sliding time window: at most `limit` requests could start per `interval` (1000ms), and the in-flight counter was decremented from inside a fire-and-forget `setTimeout(interval)` callback. That same timer was also the only place that re-pumped the queue.

This design fails on Cloudflare Workers (and comparable edge runtimes such as miniflare, Shopify Oxygen). The isolate suspends as soon as a response is sent, and any timer that has not yet fired is dropped. Because nothing awaits the throttle's release timer, `activeCount` is never decremented. The client is a cross-request singleton (`@storyblok/astro` stores it on `globalThis`, and the React/Hydrogen integrations follow the same pattern), so the leaked count survives request boundaries and climbs monotonically. Once `activeCount` reaches `limit`, `throttled()` stops pumping the queue, queued promises never settle, the SSR handler hangs, and Cloudflare kills the request with a `1101` error. The backlog rebuilds after every manual restart.

Reported in monoblok issues #533 (Astro), #319 and #353 (Hydrogen/Oxygen), and previously in the archived js-client issue #682. The failure signature is precise: the Worker fails after roughly `limit` successful requests, and #319 confirmed the count tracks the configured `rateLimit` exactly.

Any time-window rate limiter is fundamentally incompatible with this runtime, because spreading requests over time requires a timer to release slots, and cross-request timers are exactly what the isolate drops. Relying on `ctx.waitUntil` to keep timers alive is not an option either: it would tie the throttle to a Workers-specific API and still race the isolate lifecycle.

## Decision

Replace the time-window throttle with a **completion-driven concurrency limiter**.

1. **At most `limit` invocations run at once.** A concurrency slot is released in a `finally` block the moment its invocation settles, and the queue drains from there. Release and draining never depend on a scheduled timer, so isolate suspension cannot leak the in-flight count or wedge the queue.
2. **`interval` is retained in the internal signature for API compatibility but is no longer used.** Any timer-based pacing would reintroduce the hang described above.
3. **A non-positive or non-finite `limit` disables throttling** and lets every request pass through. This gives Workers users a deterministic opt-out (`rateLimit: 0` or `Infinity`), which #319 requested and which previously either deadlocked (`0`) or threw (`Infinity`).
4. **`abort()` rejects queued promises with an `AbortError` instance** rather than a function value.

Server-side rate limiting remains covered by the existing `429` retry path in `cacheResponse`, which honors the server's backoff regardless of client-side pacing.

## Alternatives Considered

- **Keep the time window, but release slots via `ctx.waitUntil`.** Rejected: couples the client to a Workers-specific API, still races the isolate lifecycle, and does nothing for other runtimes.
- **Keep the time window, but await the spacing timer inside the request lifecycle.** Rejected: either delays every response by `interval` (unacceptable latency) or, if the spacing runs after the response resolves, reintroduces the exact detached-timer hang.
- **Make the client per-request instead of a singleton.** Rejected: the singleton on `globalThis` is the correct pattern for Workers (it preserves the in-memory cache across requests); the defect is in the throttle, not the integration.

## Consequences

- **The client no longer proactively paces requests per second.** It caps simultaneous in-flight requests per rate-limit tier instead. Bursts of fast requests can now exceed the old per-second rate; the server's `429` response and the client's retry path absorb the overflow. For the tiers Storyblok returns (single/small 50, medium 15, large 10, very large 6, cached 1000, Management API 3), the concurrency cap is a reasonable proxy that never hangs.
- **`rateLimit: 0` and `rateLimit: Infinity` now mean "no throttle"** rather than deadlocking or throwing.
- **Behavior change is not observable through the public API surface**, only through timing. The `throttledQueue` and `ThrottleQueueManager` utilities are internal and not re-exported.
- **Tests that asserted per-second distribution were rewritten** to assert concurrency capping, queue-tier keying, and completion. A regression test simulates the Workers runtime by leaving every scheduled timer pending and asserting the queue still drains.

## Related ADRs

- None.
