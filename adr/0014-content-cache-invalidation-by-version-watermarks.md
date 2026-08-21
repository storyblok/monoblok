# ADR-0014: Content Cache Invalidation by Version Watermarks

**Status:** Accepted **Date:** 2026-08-21

## Context

Both content clients cache published CDN responses and have to notice publishes promptly. Two
signals are available: the `cv` a content response reports in its body, and the `space.version`
reported by `/cdn/spaces/me`, an endpoint cached for two seconds where content is cached for a week
— the cheapest way to poll for a publish.

The behaviour of the API these signals describe was verified against the live CDN:

- A published request **without** a `cv` is redirected (301) to the same URL with the current `cv`.
  It costs one extra hop and can never be stale.
- A published request with any `cv` the edge does not hold — `0`, a stale one, even a future one —
  gets the same redirect to the current version.
- A published request with an **old `cv` the edge still holds** is served that old snapshot for up
  to a week. This is the only path to stale content.
- A response body's `cv` identifies the snapshot that was actually served.
- Draft requests ignore `cv` entirely and are never redirected.
- Without a Minimum Cache TTL, `space.version` and `cv` report the same raw version. With one, the
  `cv` is floored into TTL-sized buckets, so it lags permanently. The two are different units, and
  only same-signal comparisons carry information.
- `space.version` is monotonic at the origin, but a two-second per-POP cache means a poll can be
  answered with a lower one.

The first implementation treated invalidation as an **event**: when a signal moved, flush the cache.
Because a flush destroys evidence rather than recording it, every edge case needed compensating
machinery — a cache epoch to reject responses that were in flight across a flush, and a "settle"
protocol (a pending revalidation, cv stripping, in-flight promise coordination) to disambiguate the
first `space.version` sighting. A review of that machinery found nine defects, all of them in the
compensation rather than in the signals: a `0` sentinel reaching the wire, an entry stored under the
wrong key, flush ordering that dropped the very response that triggered the flush, version
comparisons that fired on regressions, and invalidation state scoped to a client instance while the
cache it governed was shared.

The decisive observation: published content is an **immutable snapshot addressed by its `cv`**. An
entry is valid exactly as long as the `cv` it was served under is still the current one. That is a
property of the entry, not an event in time — and the origin corrects any wrong address for the
price of one redirect.

## Decision

**Cache entries carry the version they belong to, and the client tracks two monotonic watermarks in
the cache provider. Invalidation is a mismatch, not a flush.**

1. **Entries are tagged.** `CacheEntry.cv` records the `cv` the response reported, or — for
   endpoints that report none, like `/cdn/tags` and `/cdn/links` — the `cv` the request was issued
   under.
2. **Two watermarks, one per signal.** `knownCv` (highest `cv` seen in a body) and
   `knownSpaceVersion` (highest version seen from `/cdn/spaces/me`). Both advance by monotonic max
   only, so a stale edge read never moves them. They are never compared to each other, except once:
   on the very first sighting, a `space.version` ahead of `knownCv` is treated as a possible
   publish, because there is no earlier space version to compare against.
3. **They live in the cache provider**, under the reserved key `sb:versions:v1:<accessToken>`, so
   they share fate with the entries they govern. Every client and process sharing a provider shares
   the watermarks — which is what makes the publish signal work for a per-request client in a
   serverless deployment, where instance state does not survive.
4. **A read is a hit when the entry is TTL-fresh and its tag equals `knownCv`.** A publish sets
   `knownCv` to undefined, which makes every tagged entry unreachable at once and sends the next
   request out without a `cv`, taking the origin's redirect to the current version. Nothing is
   flushed: unreachable entries expire by TTL and LRU, and flushing would also empty a provider
   other clients keep their own entries in.
5. **A response is discarded when the `cv` it was issued under is no longer the known one.** That is
   the entire in-flight problem: the response was answered for a version that has since been
   superseded, so it neither teaches a `cv` nor gets stored. No epoch counter, and it holds across
   clients and processes because the comparison is against shared state.
6. **A caller-pinned `cv` is honoured literally.** Such a request is keyed by its own `cv`, is
   immune to publishes, expires by TTL alone, and never teaches a watermark: it describes the
   caller's choice, not the space's current state.
7. **`flushCache()` stays** for webhook-driven invalidation under `cache.flush: 'manual'`: it
   empties the provider and resets the watermark record.

`storyblok-js-client` keeps its flush-based mechanism — it is widely deployed and its custom cache
providers observe its key shapes — but adopts the same semantics: no falsy `cv` on the wire,
monotonic comparisons in both directions, the entry stored after any flush its own response
triggered, and the signal scoped to the cache keyspace that would act on it.

## Consequences

- The epoch, the settle protocol and cv stripping are gone, along with roughly 150 lines of
  concurrency machinery and the defect class that came with it. A publish costs one redirect per
  active key instead of a coordinated revalidation.
- `cache.flush: 'auto'` no longer calls `provider.flush()`. Invalidated entries linger until TTL or
  LRU eviction, bounded by the existing 1 000-entry cap — the trade for not emptying a shared
  provider on someone else's behalf. `CacheEntry` gains an optional `cv`; custom providers store
  entries opaquely and need no change, but they must not use the reserved key.
- Each cacheable request reads the watermark record in addition to its entry, issued in parallel:
  free for the in-memory provider, one extra round trip for an external one — still far cheaper than
  the origin fetch it prevents.
- A space with a Minimum Cache TTL pays one needless revalidation per watermark record, from the
  first-sighting comparison. Bounded and self-answering.
- Endpoints that report no `cv` are only invalidated when they were fetched while a `cv` was known;
  a response fetched during an unknown-`cv` window falls back to TTL alone.
