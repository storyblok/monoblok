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

### What a publish actually does

The scenario that could break this is a warm client whose traffic goes cold all at once, so we
measured it rather than reasoning about it. A publish turns out **not** to purge anything: a URL
pinned to a content version kept serving hits with a rising `Age` for as long as we watched it, well
past the publish. What a publish does is mint a new content version. A client that follows it lands
on cache keys nothing has warmed, and _that_ is the cold transition — a key rotation, not a purge.
It is still abrupt: every URL goes cold at once.

Driving sustained traffic against one warm URL until the ceiling had visibly climbed, then
publishing mid-run and following the new version onto cold keys, the transition costs a burst of
429s proportional to the ceiling:

| ceiling | warm plateau reached | 429s in the transition | back inside the tier after |
| ------: | -------------------: | ---------------------: | -------------------------: |
|      1x |                6 r/s |                      0 |                          — |
|      4x |               24 r/s |                      8 |                       4.5s |
|     10x |               59 r/s |                     12 |                       2.4s |
|     20x |              120 r/s |                 24, 27 |                 1.7s, 1.6s |

The burst is not the window being slow. It is the requests already in flight when the first miss
comes back: roughly the ceiling times one round trip, which no feedback can react its way out of. We
built the obvious reactive fix first — clamp on a run of consecutive misses rather than waiting for
the average — and measured it changing the burst from 27 to 24, inside the run-to-run spread. The
clamp does work (a bucket at 120/s drops to its 6/s limit after ten misses, where the average alone
would still allow 25/s); it just cannot touch the part of the burst that was already on the wire.

That leaves bounding the ceiling as the only lever with real leverage on the worst case.

## Decision

The Content API client's ceiling is discovered rather than fixed. Each tier keeps a rolling window
of the last 50 responses whose cache status it could read, and its ceiling becomes
`tierLimit / (1 - hitShare)`, bounded by **eight times the tier** and by 1000/s.

That formula is the whole argument: only the share of requests that misses the cache reaches the
origin, so a tier running at `tierLimit / (1 - hitShare)` still puts no more than `tierLimit`
requests per second on the origin. It is the tier limit exactly when nothing is cached, twice it at
a half-cached workload, ten times it at nine-tenths.

The ceiling only sets how far AIMD may recover to. The rate still climbs a twenty-fifth of the
ceiling per quiet second and still halves on a 429, so a tier reaches a raised ceiling over tens of
seconds of uninterrupted success, never in a burst.

The multiple is a judgement on a measured curve, not a derived constant: the gain flattens while the
transition cost keeps rising roughly linearly with the ceiling. Eight keeps most of the benefit —
400/s on the 50/s tier, 48/s on the 6/s one — at a bounded worst case. Measured on the shipped
configuration against the 6/s tier, the warm plateau is 48 r/s with no 429s at all, and the
transition issues 40 requests of which 7 are throttled, over 1.1s, with admissions back inside the
tier two seconds after the new version appears.

Six things keep the cold and mixed cases from regressing:

- A response with no readable cache status is not an observation. A browser, or any runtime that
  cannot see the header, keeps an empty window and the tier limit — today's behaviour exactly.
- The ceiling leaves the tier limit only once the window holds 50 observations, so a client never
  extrapolates from a handful of lucky hits.
- The ceiling is recomputed on every response and the rate is clamped to it immediately. A workload
  that turns cold refills the window within 50 responses and drops back to the tier without waiting
  for a 429.
- A run of ten consecutive origin-served responses puts a tier back on its limit at once, without
  waiting for the average. A single hit lifts it again and the window is kept, so a brief cold patch
  costs the climb back rather than the measurement.
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
- This reverses ADR-0016's guarantee that adaptation can only make a client more conservative. A
  working set going cold costs a bounded burst of 429s — 7 over about a second on the 6/s tier,
  where a client pinned to the tier would have had none. AIMD absorbs it by halving, which is the
  same mechanism the tier limit relies on, and admissions are back inside the tier within two
  seconds.
- The transition cost scales with the tier, so the 50/s tier pays proportionally more than the 6/s
  one we measured. The eight-times bound is what keeps it proportional rather than absolute.
- The benefit is Node-only in practice. Browser clients cannot read the cache status and are
  unaffected, for better and for worse.
- The hit share is measured per tier, not per URL, so a tier mixing a hot listing with cold ones is
  paced by their average. That is the correct aggregate: the origin sees the aggregate too.
- The cached ceiling is a documented figure, not a measured one, and with the eight-times bound in
  place no tier reaches it anyway: it now only matters for a caller configuring a rate of its own.
- A client pinned to an old content version never goes cold at all, since that version's entries are
  not purged. The cold transition is paid once per version the client follows, not once per publish
  it is unaware of.
