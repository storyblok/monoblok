# ADR-0018: Content Cache Invalidation by Version Watermarks

**Status:** Accepted  
**Date:** 2026-09-29

## Context

`@storyblok/api-client` and `storyblok-js-client` cache published CDN responses and have to notice
publishes promptly. Two signals are available: the `cv` a content response reports in its body, and
the `space.version` reported by `/cdn/spaces/me`. That endpoint is cached for two seconds where
content is cached for a week, which makes it the cheapest way to poll for a publish.

The API behavior these signals describe, verified against the live CDN:

- A published request **without** a `cv` is redirected (301) to the same URL with the current `cv`.
  It costs one extra hop and can never be stale.
- A published request with any `cv` the edge does not hold (`0`, a stale one, even a future one)
  gets the same redirect to the current version.
- A published request with an **old `cv` the edge still holds** is served that old snapshot for up
  to a week. This is the only path to stale content. On the wire it looks exactly like a response to
  a caller who pinned that `cv` on purpose; only the caller's intent separates the two.
- A response body's `cv` identifies the snapshot that was actually served.
- Draft requests ignore `cv` entirely and are never redirected.
- Without a Minimum Cache TTL, `space.version` and `cv` report the same raw version. With one, the
  `cv` is floored into TTL-sized buckets and lags permanently, so only same-signal comparisons carry
  information.
- `space.version` never decreased in testing, but each edge location caches `/cdn/spaces/me` for two
  seconds, so a poll can be answered with a lower one.

Published content is an **immutable snapshot addressed by its `cv`**: an entry is valid exactly as
long as the `cv` it was served under is still the current one. That is a property of the entry, not
an event in time, and the origin corrects any wrong address for the price of one redirect.

## Decision

**Cache entries carry the version they belong to, and `@storyblok/api-client` tracks monotonic
version watermarks in the cache provider. Invalidation is a mismatch, not a flush.**

1. **Only a positive `cv` is a version.** The API redirects `0` like any `cv` the edge does not
   hold, so it is rejected where the body is read. No numeric sentinel ever reaches the wire.
2. **Entries are tagged.** `CacheEntry.cv` records the `cv` the response reported or, for endpoints
   that report none (`/cdn/tags`, `/cdn/links`), the `cv` the request was issued under. Every
   response that isn't discarded teaches a `cv`, whether or not it is stored. A draft response is
   never stored, but its `cv` is the same version a published one reports, so it invalidates
   published entries too; an application that reads both but never polls `/cdn/spaces/me` has no
   other signal.
3. **One watermark per signal.** `knownCv` (highest `cv` seen in a body) and `knownSpaceVersion`
   (highest version seen from `/cdn/spaces/me`) advance by monotonic max only, so a stale edge read
   never moves them. They are compared to each other once: on the first sighting, a `space.version`
   ahead of `knownCv` counts as a possible publish, because there is no earlier space version to
   compare against. `highestCv` records the highest `cv` ever held and is never dropped. An
   invalidation resets `knownCv`, and the response right after it is the one that teaches the next
   `cv`, so the floor that recognizes a stale edge read has to outlive the reset.
4. **The watermarks live in the cache provider**, under the reserved key `sb:versions:v1:<tokenId>`,
   so they share fate with the entries they govern. Every client and process sharing a provider
   shares them, which is what makes the publish signal work for a per-request client in a serverless
   deployment. A missing record reads as "`cv` unknown", so a tagged entry counts as stale instead
   of falling back to TTL alone; one refetch rewrites it.
5. **Entry keys are scoped to the space.** The access token selects the space and travels outside
   the query, so without it two clients sharing one provider read each other's content. Keys carry a
   non-cryptographic hash of the token, not the token, since keys reach key listings, Redis
   `MONITOR` output, and metrics labels.
6. **A read is a hit when the entry is TTL-fresh and its tag equals `knownCv`.** A publish sets
   `knownCv` to undefined. That makes every tagged entry unreachable at once and sends the next
   request out without a `cv`, taking the origin's redirect to the current version. Nothing is
   flushed: unreachable entries expire by TTL or eviction, and flushing would also empty a provider
   other clients keep their own entries in.
7. **A response is discarded when the `cv` it was issued under is no longer the known one**, unless
   its own body reports the `cv` that superseded it. It was answered for a superseded version, so it
   neither teaches a `cv` nor gets stored. This holds across clients and processes because the
   comparison is against shared state, and it applies to draft responses too, which would otherwise
   teach back the `cv` a publish dropped. The body alone can't replace the issue-time comparison:
   under a Minimum Cache TTL a late pre-publish response and a fresh floored refetch report the same
   `cv`. A request issued while no `cv` was known is compared by the space version instead: when it
   moved since issue, a publish superseded the request. Neither comparison sees an explicit flush,
   so the record also carries a `generation` that only `flushCache()` bumps; a response whose
   generation no longer matches is discarded.
8. **A caller-pinned `cv` is honored literally.** The request is keyed by its own `cv`, is immune to
   publishes, and expires by TTL alone. The response teaches no watermark when it reports the pinned
   `cv` back, or no `cv` at all. The stale-read rule is gated on that, because the snapshot a pinned
   request receives looks exactly like a stale edge read. A `cv` the edge doesn't hold, such as the
   documented `cv: Date.now()` cache bust, is redirected to the current version, and that response
   is tracked like any other.
9. **`flushCache()` stays** for webhook-driven invalidation under `cache.flush: 'manual'`. It
   empties the provider and resets the record, keeping `highestCv`, `knownSpaceVersion`, and the
   bumped `generation`.

`storyblok-js-client` keeps its flush-based mechanism, because it is widely deployed and its custom
cache providers observe its key shapes. It adopts these rules:

- No falsy `cv` goes on the wire.
- Comparisons are floored at the highest `cv` ever seen, not the tracked one, which a flush zeroes.
- A response that was in flight across a flush neither teaches a `cv` nor gets cached. That includes
  one still waiting for its cache lookup, and one whose own flush overlapped another.
- An entry is stored under the `cv` its response adopted, or else the one it was requested with.
- A caller's `cv` counts as pinned only when the response reports it back, or reports no `cv` at
  all. A `cv` the edge doesn't hold, such as the documented `cv: Date.now()` cache bust, is
  redirected to the current version, and that response is tracked like any other.
- The space-version signal is scoped to the provider object, so per-request clients sharing one
  provider share it. A handler that builds its provider inline per request gets a new identity each
  time, so every poll is a first sighting, judged against the highest `cv` the process has seen.

## Guarantees and Scope

The API offers no version source the client can adopt directly: `/cdn/spaces/me` reports a
`space.version` that a Minimum Cache TTL makes incomparable to `cv`, and `/cdn/links` and
`/cdn/tags` report no `cv`. The clients infer the current version from responses that arrive late
and out of order, and `CacheProvider` has no compare-and-swap. Freshness under every interleaving of
concurrent requests is therefore not a goal. The guarantees are:

- Without concurrent requests, and with automatic invalidation enabled (`cache.flush: 'auto'` or
  `cache.clear: 'auto'`) and no Minimum Cache TTL, a publish is visible after the next poll of
  `/cdn/spaces/me` or the next draft read.
- With concurrent requests, a publish can be noticed one poll late, and a response racing a
  `flushCache()` can restore what the flush emptied. Once requests settle, the next poll and read
  within one client are current.
- Coordination between instances that don't share a provider object is out of scope: in
  `storyblok-js-client` the tracked `cv` is per token and process, while the in-flight guard is per
  provider, so one instance's late response can re-pin a `cv` another instance's flush dropped.

An API that reported the current `cv` on `/cdn/spaces/me` would let the clients adopt the version
directly and retire most of the inference.

## Alternatives Considered

- **Flush on every signal change.** A flush destroys the evidence a later response needs to be
  judged by, so it needs compensating machinery: an epoch to reject responses in flight across the
  flush, and a revalidation protocol to settle the ambiguous first `space.version` sighting. That
  machinery is where the defects cluster: a `0` sentinel on the wire, entries under the wrong key, a
  flush dropping the response that triggered it, and state scoped to a client while the cache it
  governs is shared. `storyblok-js-client` keeps this model for compatibility.
- **Decide staleness from the request's `cv` alone.** Under a Minimum Cache TTL a stale and a fresh
  response report the same floored `cv`, so the request's `cv` can't tell them apart.

## Consequences

- `cache.flush: 'auto'` no longer calls `provider.flush()`. Invalidated entries linger until TTL or
  eviction, bounded by the default in-memory provider's 1,000-entry cap, in exchange for not
  emptying a shared provider on someone else's behalf. Custom providers must expire entries by
  `ttlMs` themselves, since the client doesn't check it.
- `CacheEntry` gains an optional `cv` that custom providers must round-trip. A provider that
  rebuilds entries from `value`, `storedAt`, and `ttlMs` alone serves pre-publish content until TTL,
  where the previous flush emptied it. Custom providers must not use the reserved key. Entry keys
  change shape, so an external provider carried across the upgrade refills once.
- In a space without publishes, the watermark record expires after seven days, and every tagged
  entry is refetched once.
- Each cacheable request reads the watermark record next to its entry, in parallel, and again when
  the response lands. That's free for the in-memory provider and a round trip for an external one,
  still far cheaper than the origin fetch it prevents.
- Draft requests and polls read the record alongside the request, then update it before they
  resolve: one provider round trip after the response, or three when a version moved. Resolving
  first would let the next sequential read miss the invalidation. A provider failure on that path
  costs the signal, not the response.
- A space with a Minimum Cache TTL pays one needless revalidation per watermark record, from the
  first-sighting comparison.
- Enabling a Minimum Cache TTL on a token already in use lowers the reported `cv` below the highest
  one seen, so in both clients every response reads as a stale edge read and nothing is cached until
  the floored `cv` catches up, at most one TTL bucket later.
- Endpoints that report no `cv` are only invalidated when they were fetched while a `cv` was known.
  A response fetched during an unknown-`cv` window falls back to TTL alone.
- After a publish is noticed, a response in flight whose body already carries the new `cv` is still
  discarded until another response re-teaches that `cv`, which costs one refetch of that key.
- A cached entry whose `cv` a publish invalidated is withheld from the cache strategy, so a
  `network-first` or `swr` read during an outage right after a publish returns the error instead of
  pre-publish content.
- The record is read, merged, and written back without a lock. The write re-reads the generation
  first and gives up when it moved, which narrows a racing `flushCache()` to the write itself. A
  response write landing inside that window restores the pre-flush record and entry, which under
  `cache.flush: 'manual'` lasts until the next flush. Closing it, and the window between `flush()`
  deleting the record and `flushCache()` writing the next one, needs a compare-and-swap
  `CacheProvider` does not offer.
- The `storyblok-js-client` first-sighting state is per process. Under a Minimum Cache TTL, where
  the floored `cv` never equals the raw space version, every cold start flushes the shared cache
  once.
- `storyblok-js-client` stores an entry under the `cv` its response adopted, and a cold process
  tracks no `cv`, so it can't hit entries another process stored. With a shared external provider,
  every cold start refetches each key once. Hitting the key without a `cv` instead would serve
  pre-publish content to every cold process indefinitely.
