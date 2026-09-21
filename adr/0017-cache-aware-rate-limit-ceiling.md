# ADR-0017: Cache-Aware Rate-Limit Ceiling in the Content API Client

**Status:** Accepted **Date:** 2026-09-21

Amends ADR-0016.

## Context

The Content Delivery API's per-second tiers — 50/s for a single story or a listing of at most 25
items, 15/s for 26-50, 10/s for 51-75, 6/s for 76-100 — apply to requests that reach the origin. The
documentation puts requests answered from the CDN cache at 1000/s, and those are answered at the
edge, so they cost nothing against the tier.

ADR-0016's ceiling is the tier limit, and adaptation can only move below it. A client whose traffic
is mostly cached is therefore paced by a limit that does not apply to most of its requests: a
published build fetching 100-item listings sits at 6/s while the edge would serve it far faster.

Two things had to be true before this was worth building, and both were measured against the live
API rather than taken from the documentation.

**A client can tell a cache hit from a miss.** Every CDN response carries an `X-Cache` header, on
the first request as much as the hundredth: `Hit from cloudfront` for an entry served from the edge,
`Miss from cloudfront` for one that reached the origin, `RefreshHit from cloudfront` for one
revalidated against the origin, `Error from cloudfront` for a 4xx. An `Age` header appears only
alongside a hit. Only a plain hit is free — a revalidation is a request to the origin like any
other.

**The tiers behave as documented.** Paced at 10/s, forced-miss 100-item listings were throttled on
17 of 40 requests; at 5/s, on 1 of 20. Forced-miss requests in the 50/s tier paced at 80/s were
throttled; the same rate against a cached URL was not throttled once in over 200 requests. The 429
carries no `Retry-After` and no rate-limit headers, so there is nothing to read off it but its
status.

One finding constrains the design rather than supporting it: the API's
`Access-Control-Expose-Headers` lists `Api-Version, Token, Total, Per-Page`. `X-Cache` and `Age` are
not among them, so a browser client cannot read the cache status at all. Whatever we build has to
treat "no signal" as the common case and behave exactly as it does today when it sees one.

We also confirmed that the `X-RateLimit` and `X-RateLimit-Policy` headers are sent only for
`version=draft` requests, and describe a cap on simultaneous requests
(`"space-concurrent-requests";q=30`) rather than a rate. ADR-0016's limiter already ignores that
quota; nothing here changes.

## Decision

The Content API client's ceiling is discovered rather than fixed. Each tier keeps a rolling window
of the last 50 responses whose cache status it could read, and its ceiling becomes
`tierLimit / (1 - hitShare)`, capped at 1000/s.

That formula is the whole argument: only the share of requests that misses the cache reaches the
origin, so a tier running at `tierLimit / (1 - hitShare)` still puts no more than `tierLimit`
requests per second on the origin. It is the tier limit exactly when nothing is cached, twice it at
a half-cached workload, ten times it at nine-tenths.

The ceiling only sets how far AIMD may recover to. The rate still climbs a twenty-fifth of the
ceiling per quiet second and still halves on a 429, so a tier reaches a raised ceiling over tens of
seconds of uninterrupted success, never in a burst.

Five things keep the cold and mixed cases from regressing:

- A response with no readable cache status is not an observation. A browser, or any runtime that
  cannot see the header, keeps an empty window and the tier limit — today's behaviour exactly.
- The ceiling leaves the tier limit only once the window holds 50 observations, so a client never
  extrapolates from a handful of lucky hits.
- The ceiling is recomputed on every response and the rate is clamped to it immediately. A workload
  that turns cold refills the window within 50 responses and drops back to the tier without waiting
  for a 429.
- A revalidated entry and a 429 both count as reaching the origin, which is what they do.
- An explicit `requestsPerSecond` is a rate the caller asked for, and `adaptive: false` pins every
  tier outright. Neither is overridden. `rateLimit.cacheAware: false` turns the mechanism off on its
  own.

The mechanism lives in the limiter both clients share, configured by a cached ceiling and a
cache-hit detector that only the Content API client supplies. Unconfigured it is inert, so the
Management API client — which has no CDN cache in front of it — behaves as before without the shared
file diverging between the two copies.

## Consequences

- A client on warm published traffic finds its own headroom, up to 1000/s, without configuration.
- This reverses ADR-0016's guarantee that adaptation can only make a client more conservative. The
  ceiling can now exceed the tier, and a workload whose hit rate falls faster than the window
  refills will meet a 429 it would previously have avoided. AIMD absorbs it by halving, which is the
  same mechanism the tier limit relies on.
- The benefit is Node-only in practice. Browser clients cannot read the cache status and are
  unaffected, for better and for worse.
- The hit share is measured per tier, not per URL, so a tier mixing a hot listing with cold ones is
  paced by their average. That is the correct aggregate: the origin sees the aggregate too.
- The cached ceiling is a documented figure, not a measured one. If it is wrong, it is wrong in the
  direction of a ceiling AIMD rarely reaches.
