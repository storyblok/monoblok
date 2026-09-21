# 16. Adaptive and pluggable rate limiting in the API clients

Date: 2026-09-21

## Status

Accepted

## Context

Storyblok enforces rate limits per token. The clients enforce them per instance. Whenever several
instances run against one token — two builds of an A/B-tested site, a CI matrix, a worker fleet, a
load-balanced renderer — each one paces itself correctly and the fleet still overruns the quota
between them. The result is 429s that the retry budget sometimes cannot absorb, and a build that
fails.

The two workarounds available today are both bad. Dividing `requestsPerSecond` by the number of
instances forces a single fixed rate across every request type, so a client that mixes single-story
fetches (quota 50/s) with 100-item listings (quota 6/s) has to adopt the lowest tier for all of
them. Raising the retry budget trades the failures for a slower build.

We simulated the problem before choosing: several client instances sharing one token against a
server holding one rolling-window quota per tier, on a virtual clock, with the real limiter code
under test. Two workloads — a build fetching one story per page, and a build mixing page fetches
with 50- and 100-item listings — across 1, 2, 4, 8 and 16 instances.

`success` is the share of issued requests that eventually returned data; `goodput` counts only
those. The baseline's flat wall-clock time hides the reason: it does not finish the work faster, it
abandons more of it.

### Uniform small requests (quota 50/s)

| arm              | instances |  429s | dropped | success | makespan | goodput req/s |
| ---------------- | --------: | ----: | ------: | ------: | -------: | ------------: |
| baseline         |         1 |     0 |       0 |  100.0% |    7.29s |          54.9 |
| aimd             |         1 |     0 |       0 |  100.0% |    7.29s |          54.9 |
| shared-store     |         1 |     0 |       0 |  100.0% |    7.31s |          54.7 |
| baseline         |         4 |  2484 |     324 |   79.8% |   25.77s |          49.5 |
| baseline-divided |         4 |     0 |       0 |  100.0% |   33.07s |          48.4 |
| aimd             |         4 |   250 |      38 |   97.6% |   40.30s |          38.8 |
| shared-store     |         4 |     0 |       0 |  100.0% |   31.12s |          51.4 |
| baseline         |        16 | 19096 |    4027 |   37.1% |   48.13s |          49.3 |
| baseline-divided |        16 |     0 |       0 |  100.0% |  133.07s |          48.1 |
| aimd             |        16 |  2964 |     425 |   93.4% |  130.28s |          45.9 |
| shared-store     |        16 |     0 |       0 |  100.0% |  127.07s |          50.4 |

### Mixed tiers (quotas 50/s, 15/s and 6/s at once)

| arm              | instances |  429s | dropped | success | makespan | goodput req/s |
| ---------------- | --------: | ----: | ------: | ------: | -------: | ------------: |
| baseline         |         4 |  1485 |     142 |   88.2% |   16.05s |          65.9 |
| baseline-divided |         4 |     0 |       0 |  100.0% |  299.06s |           4.0 |
| aimd             |         4 |   312 |      36 |   97.0% |   22.87s |          50.9 |
| shared-store     |         4 |     0 |       0 |  100.0% |   19.06s |          62.9 |
| baseline         |        16 | 12842 |    2517 |   47.6% |   33.29s |          68.6 |
| baseline-divided |        16 |  1228 |     148 |   96.9% |  299.07s |          15.6 |
| aimd             |        16 |  3337 |     477 |   90.1% |   67.52s |          64.0 |
| shared-store     |        16 |     0 |       0 |  100.0% |   79.07s |          60.7 |

What the runs establish:

- A single instance is unaffected by adaptation — the same requests, the same timing, no 429s.
  Turning it on by default costs nothing in the common case.
- Adaptation converts most failures into latency. At 16 instances it takes the share of requests
  that succeed from 37% to 93% on the uniform workload, and from 48% to 90% on the mixed one.
- It does not make the fleet correct. It reacts to a 429, so the first overrun always happens, and
  its convergence is uneven: instances that back off early finish well after the others.
- Dividing the rate by hand is the worst option as soon as tiers are mixed: it costs a 16x slowdown
  at 4 instances, and it is still wrong at 16, where integer division floors to 1 req/s per instance
  and overruns the 6/s tier anyway.
- A limiter over shared storage is the only arm that is never throttled, at every instance count and
  on both workloads. Its cost is a round trip per request and infrastructure we do not own.
- Shared storage and adaptation do not fight: combining them reproduced the shared-store numbers
  exactly, since a limiter that never overruns has nothing to react to.

We also tested spreading the recovery interval across instances, on the theory that they recover in
lockstep and overshoot together. It moved the 429 count by at most 10%, inside the run-to-run
spread, and would have made the limiter's behaviour depend on a random source. Rejected.

## Decision

Admission control moves behind a `RateLimiter` interface — `acquire(context)`, optional
`recordResponse(context, response)` and `release(context)` — with an in-memory implementation as the
default. `context` carries the request path and query, the bucket the request draws from, and the
per-second rate the client would have applied on its own.

The default limiter adapts: on a throttled response a bucket's rate drops multiplicatively, and it
recovers additively while nothing is throttled. It is bounded on both sides — never above the rate
the client would have used anyway, never below a floor — so it can only ever make a client more
conservative than it is today. It is on by default and switched off with
`rateLimit.adaptive: false`.

Responses reach the limiter through a wrapper around `fetch` rather than from the call site. The
call site only ever sees the last response of a request; the 429s a retry replaced are most of the
signal, and they are exactly the ones it would miss.

Passing `rateLimit.limiter` replaces the in-memory default outright. A fleet sharing a token holds
itself to one quota by pointing every instance at the same Redis or Upstash bucket, dividing
`context.limit` by the instance count, or whatever else fits the deployment.

## Consequences

- Clients sharing a token degrade instead of failing, without configuration.
- Adaptation reacts rather than prevents: the first overrun still happens, and a fleet that must
  never be throttled needs a shared limiter.
- Under adaptation instances converge unevenly, so one instance can finish well after another. For a
  build fleet, total time matters and this is acceptable; it is the reason the fairness numbers are
  reported above rather than hidden.
- The interface is public API. Its shape is now a compatibility commitment.
- `limiter.ts` and `throttle.ts` are duplicated verbatim between the two clients, which keeps them
  free of a shared runtime dependency at the cost of applying every change twice.
