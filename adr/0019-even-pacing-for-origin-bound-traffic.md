# ADR-0019: Even Pacing for Origin-Bound Traffic

**Status:** Accepted  
**Date:** 2026-10-01

Amends ADR-0016 and ADR-0017.

## Context

The per-tier limiter is a rolling one-second window: a queue of 50 requests on the 50/s tier starts
all 50 at the same instant. Network jitter packs their arrival at the API into less than a second,
and when they reach the origin a few come back as 429.

Before ADR-0016 that cost little, because retries bypassed the limiter. Since then every HTTP
attempt is admitted separately, so a retried request waits behind the rest of the wave, and the
adaptive back-off halves the tier on the 429. Both are right for a fleet sharing a token, and the
fleet numbers depend on them. A single static build right after a publish (every key cold) paid for
both: 278 concurrent calls took 8.6-8.7 s, against 5.5 s on 0.7.4.

None of the `adaptive` settings fixed it. `adaptive: false` came closest at 6.7 s, still with ~47
429s per build; gentler or faster-recovering back-off landed between 6.7 and 9.7 s.

## Decision

While at least half of the last 20 responses, across all buckets, reached the origin (`X-Cache` not
a plain hit, 429s included), each bucket starts its requests evenly spaced, one every `1000 / rate`
ms. Otherwise the instant window stays.

The signal is shared across buckets because a publish turns every key cold at once, and a fresh
client's first response (its `cv` discovery read) already reports it. Pacing applies only with
`cacheAware`, the one configuration that can read the cache status; the Management API client and
browsers keep the window.

## Consequences

Measured live, 0.9.0 vs. this change:

| scenario                        |             0.9.0 |        even pacing |
| ------------------------------- | ----------------: | -----------------: |
| cold build, 278 calls           | 8.7 s, 5-10 × 429 | 6.1-6.3 s, 0 × 429 |
| warm build, 278 calls           |             4.5 s |              4.5 s |
| 4 instances on one token        |     ~15 s, 0 lost |     9-10 s, 0 lost |
| warm re-reads, 25-item listings |             400/s |              400/s |

The cold build still trails 0.7.4 by 0.5-0.7 s, which is 0.7.4's instant first window; at twice the
build size the gap is 0.2 s.

Pacing every bucket regardless of cache status was rejected: it costs warm builds 1.5 s (6.0 s
instead of 4.5 s), because a cached burst is never throttled. Deciding per bucket from five or more
samples was rejected too: the 429s come from the very first window, before a bucket has five.

A faster climb above the tier limit (doubling per quiet second) was tried and rejected. It reached
400/s in 3 s instead of 22 s, but each step opens many connections at once, and their setup stalled
warm builds to 6.9-11.8 s.
