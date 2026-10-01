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

## Ceiling and climb

The cache-aware bound rises from 8× to 20× a bucket's limit: 1,000/s on the 50/s tier, 120/s on the
6/s tier. At 20× a client held 1,000/s on warm 25-item listings with no 429s. A publish that turned
138 warm keys cold mid-run drew 41-44 × 429 at 20× against 42 at 8×, and no call failed at either.

The recovery step stays what it was at 8×: a twenty-fifth of at most eight times the limit, +16/s on
the 50/s tier. The 20× ceiling is reached after about 60 s instead of 24 s. Steeper climbs were
measured and rejected because each step opens more connections in the same second, and their setup
stalls short workloads. On warm 278-call builds, three runs each:

| climb on the 50/s tier        | warm build |
| ----------------------------- | ---------: |
| +16/s (kept)                  |  4.5-4.9 s |
| +40/s (a twenty-fifth of 20×) |  5.4-8.2 s |
| +83/s (a twelfth of 20×)      | 7.4-10.3 s |
| doubling per quiet second     | 6.9-11.8 s |
