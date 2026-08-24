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
  to a week. This is the only path to stale content. Such a response is indistinguishable on the
  wire from one a caller pinned deliberately: same status, same old body, same old `cv`. Only
  whether the caller asked for that `cv` separates a stale read from an intended one.
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

1. **Only a positive `cv` is a version.** `0` is not one the API knows — it is redirected like any
   `cv` the edge does not hold — so it is rejected where the body is read, not just where the
   watermark is written, which is what keeps the "no numeric sentinel" property true end to end.
2. **Entries are tagged.** `CacheEntry.cv` records the `cv` the response reported, or — for
   endpoints that report none, like `/cdn/tags` and `/cdn/links` — the `cv` the request was issued
   under. Every response teaches a `cv` whether or not it is cached: a draft response is never
   stored, but the `cv` it reports is the same version a published one reports — the same raw value
   without a Minimum Cache TTL, the same floored value with one — so it invalidates published
   entries like any other signal, and an application that reads both but never polls
   `/cdn/spaces/me` has no other one.
3. **Two watermarks, one per signal.** `knownCv` (highest `cv` seen in a body) and
   `knownSpaceVersion` (highest version seen from `/cdn/spaces/me`). Both advance by monotonic max
   only, so a stale edge read never moves them. They are never compared to each other, except once:
   on the very first sighting, a `space.version` ahead of `knownCv` is treated as a possible
   publish, because there is no earlier space version to compare against. A third value,
   `highestCv`, records the highest `cv` the record has ever held and is never dropped: `knownCv` is
   reset by an invalidation, and that is precisely when the next response is the one that teaches
   the version everything afterwards is measured against, so the floor a stale edge read is
   recognised against has to outlive the reset. Like `knownSpaceVersion`, it is never sent as a
   `cv`.
4. **They live in the cache provider**, under the reserved key `sb:versions:v1:<tokenId>`, so they
   share fate with the entries they govern. Every client and process sharing a provider shares the
   watermarks — which is what makes the publish signal work for a per-request client in a serverless
   deployment, where instance state does not survive. A missing record reads as "cv unknown", so a
   tagged entry is treated as stale rather than falling back to TTL alone: the record can be evicted
   while the entries it governs survive, and one refetch rewrites it.
5. **Entry keys are scoped to the space.** The access token selects the space and travels in the
   request's `token` parameter rather than in the query, so without it two clients sharing one
   provider read each other's content. Both the entry keys and the watermark key carry a
   non-cryptographic hash of the token, not the token, since keys reach listings, `MONITOR` output
   and metrics labels.
6. **A read is a hit when the entry is TTL-fresh and its tag equals `knownCv`.** A publish sets
   `knownCv` to undefined, which makes every tagged entry unreachable at once and sends the next
   request out without a `cv`, taking the origin's redirect to the current version. Nothing is
   flushed: unreachable entries expire by TTL and LRU, and flushing would also empty a provider
   other clients keep their own entries in.
7. **A response is discarded when the `cv` it was issued under is no longer the known one — unless
   its own body reports the `cv` that superseded it.** That is the entire in-flight problem: the
   response was answered for a version that has since been superseded, so it neither teaches a `cv`
   nor gets stored. No epoch counter, and it holds across clients and processes because the
   comparison is against shared state. The exception keeps a response that merely lost a race: its
   body proves it carries the current snapshot, so discarding it would make a publish cost a refetch
   of every key that happened to be in flight. The issued-under comparison cannot be dropped in
   favour of the body alone — under a Minimum Cache TTL a late pre-publish response and a fresh
   floored refetch report the same `cv`, and only issue time tells them apart. One case has no `cv`
   to compare: a request issued while none was known, racing an explicit `flushCache()`. The record
   therefore also carries a `generation` that `flushCache()` bumps, and a response whose generation
   no longer matches is discarded — the epoch, but shared through the provider instead of held on
   the instance. It is bumped only there, never on a publish, so noticing one still costs no refetch
   of what was in flight.
8. **A caller-pinned `cv` is honoured literally.** Such a request is keyed by its own `cv`, is
   immune to publishes, expires by TTL alone, and never teaches a watermark: it describes the
   caller's choice, not the space's current state. Only a positive `cv` pins: `0` is the sentinel
   `storyblok-js-client` records for "no version known", and reading it as a choice would keep it on
   the wire and file the entry under a key nothing invalidates. Because the snapshot it receives
   looks exactly like a stale edge read, the stale-read rule is gated on caller intent rather than
   on the response: without that gate a pinned entry is never stored at all, and every read past its
   TTL returns to the network for good.
9. **`flushCache()` stays** for webhook-driven invalidation under `cache.flush: 'manual'`: it
   empties the provider and resets the watermark record, keeping only `highestCv`, which is a fact
   about the space rather than about any entry, and the bumped `generation`.

`storyblok-js-client` keeps its flush-based mechanism — it is widely deployed and its custom cache
providers observe its key shapes — but adopts the same semantics: no falsy `cv` on the wire,
monotonic comparisons in both directions floored at the highest `cv` ever seen rather than at the
tracked one — a flush zeroes the latter, and the response that follows a flush is the one that
teaches the version everything afterwards is measured against — the entry stored after any flush its
own response triggered _and under the key the next read will build_ — the tracked `cv` is part of
that key, so a flush moves it and an entry filed under the pre-flush `cv` is never looked up again —
and the signal scoped to the cache that would act on it, identified by the provider object rather
than by the client instance so that per-request clients sharing one provider share the signal. That
last point holds only while the provider object outlives the client: a handler that builds its
provider inline per request hands over a new identity each time and never compares two space
versions.

## Consequences

- The epoch, the settle protocol and cv stripping are gone, along with roughly 150 lines of
  concurrency machinery and the defect class that came with it. A publish costs one redirect per
  active key instead of a coordinated revalidation.
- `cache.flush: 'auto'` no longer calls `provider.flush()`. Invalidated entries linger until TTL or
  LRU eviction, bounded by the existing 1 000-entry cap — the trade for not emptying a shared
  provider on someone else's behalf. `CacheEntry` gains an optional `cv`; custom providers store
  entries opaquely and need no change, but they must not use the reserved key. Entry keys change
  shape, so an external provider carried across the upgrade refills once.
- Each cacheable request reads the watermark record in addition to its entry, issued in parallel:
  free for the in-memory provider, one extra round trip for an external one — still far cheaper than
  the origin fetch it prevents.
- A space with a Minimum Cache TTL pays one needless revalidation per watermark record, from the
  first-sighting comparison. Bounded and self-answering.
- Endpoints that report no `cv` are only invalidated when they were fetched while a `cv` was known;
  a response fetched during an unknown-`cv` window falls back to TTL alone.
- The record is written back without a lock, so a `flushCache()` landing between a response's read
  and its write would be merged away. The write re-reads the generation first and gives up when it
  moved, which narrows the window to the write itself; closing it needs a compare-and-swap
  `CacheProvider` does not offer.
- A response issued while no `cv` was known cannot be recognised as superseded by a publish alone —
  it has no issue-time `cv` to compare, and the generation only moves on an explicit `flushCache()`.
  An unlucky one carries pre-publish content into the cache for one TTL.
- Every response on the uncached path — every draft request — reads the watermark record once, where
  `main` touched the provider not at all. That is the price of the draft signal above; it writes
  only when a version actually moved, and it never re-reads, since nothing it decides holds back a
  cache write.
- The `storyblok-js-client` first-sighting state is per process, since it lives beside the client
  rather than in the provider. Under a Minimum Cache TTL, where the floored `cv` never equals the
  raw space version, every cold start therefore flushes the shared cache once. That is the price of
  leaving that client on the flush model.
