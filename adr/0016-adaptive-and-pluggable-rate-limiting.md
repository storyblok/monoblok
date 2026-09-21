# ADR-0016: Adaptive and Pluggable Rate Limiting in the API Clients

**Status:** Accepted  
**Date:** 2026-09-21

## Context

Storyblok enforces rate limits per token. The clients enforce them per instance. Whenever several
instances run against one token (two builds of an A/B-tested site, a CI matrix, a worker fleet, a
load-balanced renderer) each one paces itself correctly and the fleet still overruns the quota
between them. The result is 429s that the retry budget sometimes cannot absorb, and a build that
fails.

Both workarounds available today cost more than they save. Dividing `requestsPerSecond` by the
number of instances forces a single fixed rate across every request type, so a client that mixes
single-story fetches (quota 50/s) with 100-item listings (quota 6/s) has to adopt the lowest tier
for all of them. Raising the retry budget trades the failures for a slower build.

We simulated the problem before choosing: several client instances sharing one token against a
server holding one rolling-window quota per tier, on a virtual clock, with the real limiter code
under test. Two workloads, across 1, 2, 4, 8 and 16 instances: a build fetching one story per page,
and a build mixing page fetches with 50- and 100-item listings.

`success` is the share of issued requests that eventually returned data; `goodput` counts only
those. The baseline's flat wall-clock time hides the reason: it does not finish the work faster, it
abandons more of it.

### Uniform small requests (quota 50/s)

| arm              | instances |  429s | dropped | success | makespan | goodput req/s |
| ---------------- | --------: | ----: | ------: | ------: | -------: | ------------: |
| baseline         |         1 |     0 |       0 |  100.0% |    7.29s |          54.9 |
| aimd             |         1 |     0 |       0 |  100.0% |    7.29s |          54.9 |
| shared-store     |         1 |     0 |       0 |  100.0% |    7.31s |          54.7 |
| baseline         |         2 |   489 |      41 |   94.9% |   15.31s |          49.6 |
| baseline-divided |         2 |     0 |       0 |  100.0% |   15.17s |          52.7 |
| aimd             |         2 |    34 |       0 |  100.0% |   19.51s |          41.0 |
| shared-store     |         2 |     0 |       0 |  100.0% |   15.20s |          52.6 |
| baseline         |         4 |  2103 |     289 |   81.9% |   26.82s |          48.9 |
| baseline-divided |         4 |     0 |       0 |  100.0% |   33.07s |          48.4 |
| aimd             |         4 |   151 |       0 |  100.0% |   35.82s |          44.7 |
| shared-store     |         4 |     0 |       0 |  100.0% |   31.12s |          51.4 |
| baseline         |         8 |  7385 |    1344 |   58.0% |   37.80s |          49.1 |
| baseline-divided |         8 |     0 |       0 |  100.0% |   66.07s |          48.4 |
| aimd             |         8 |   643 |       3 |   99.9% |   73.57s |          43.5 |
| shared-store     |         8 |     0 |       0 |  100.0% |   63.07s |          50.7 |
| baseline         |        16 | 19096 |    4027 |   37.1% |   48.13s |          49.3 |
| baseline-divided |        16 |     0 |       0 |  100.0% |  133.07s |          48.1 |
| aimd             |        16 |  1917 |      77 |   98.8% |  135.83s |          46.5 |
| shared-store     |        16 |     0 |       0 |  100.0% |  127.07s |          50.4 |

### Mixed tiers (quotas 50/s, 15/s and 6/s at once)

| arm              | instances |  429s | dropped | success | makespan | goodput req/s |
| ---------------- | --------: | ----: | ------: | ------: | -------: | ------------: |
| baseline         |         1 |     0 |       0 |  100.0% |    4.24s |          70.7 |
| baseline-divided |         1 |     0 |       0 |  100.0% |   49.06s |           6.1 |
| aimd             |         1 |     0 |       0 |  100.0% |    4.24s |          70.7 |
| baseline         |         2 |   315 |      22 |   96.3% |    9.31s |          62.1 |
| baseline-divided |         2 |     0 |       0 |  100.0% |   99.07s |           6.1 |
| aimd             |         2 |    37 |       0 |  100.0% |   14.49s |          41.4 |
| shared-store     |         2 |     0 |       0 |  100.0% |    9.13s |          65.7 |
| baseline         |         4 |  1402 |     143 |   88.1% |   15.40s |          68.6 |
| baseline-divided |         4 |     0 |       0 |  100.0% |  299.06s |           4.0 |
| aimd             |         4 |   173 |       0 |  100.0% |   21.57s |          55.6 |
| shared-store     |         4 |     0 |       0 |  100.0% |   19.06s |          62.9 |
| baseline         |         8 |  4703 |     712 |   70.3% |   24.52s |          68.8 |
| baseline-divided |         8 |     4 |       0 |  100.0% |  301.07s |           8.0 |
| aimd             |         8 |   680 |      25 |   99.0% |   40.86s |          58.1 |
| shared-store     |         8 |     0 |       0 |  100.0% |   39.07s |          61.4 |
| baseline         |        16 | 12727 |    2513 |   47.6% |   33.15s |          69.0 |
| baseline-divided |        16 |    34 |       0 |  100.0% |  305.07s |          15.7 |
| aimd             |        16 |  2224 |     179 |   96.3% |   71.29s |          64.8 |
| shared-store     |        16 |     0 |       0 |  100.0% |   79.07s |          60.7 |

What the runs establish:

- A single instance is unaffected by adaptation: the same requests, the same timing, no 429s.
  Turning it on by default costs nothing in the measured case. A client that fires a burst large
  enough to trip its own window boundary can still see a 429 and back off from it.
- Adaptation converts most failures into latency. At 4 instances it drops nothing on either
  workload, where the baseline abandons 18% and 12% of the work. At 16 it takes the share of
  requests that succeed from 37% to 99% on the uniform workload, and from 48% to 96% on the mixed
  one.
- It does not make the fleet correct. It reacts to a 429, so the first overrun always happens, and
  its convergence is uneven: instances that back off early finish well after the others.
- Dividing the rate by hand is the worst option as soon as tiers are mixed. At 4 instances it turns
  a 15s build into a 299s one, and at 16 it is still wrong: the division floors to zero, clamps to 1
  req/s per instance, and overruns the 6/s tier anyway.
- A limiter over shared storage is the only arm that is never throttled, at every instance count and
  on both workloads. Its cost is a round trip per request and infrastructure we do not own.
- Shared storage and adaptation do not fight: combining them reproduced the shared-store numbers
  exactly, since a limiter that never overruns has nothing to react to.

### Tuning

A sweep of `decreaseFactor` (0.5, 0.7, 0.8) x `increaseStep` (1, 2, 5, 10) x `recoveryIntervalMs`
(500, 1000) over both workloads at 4 and 16 instances puts halving on a one-second cooldown at the
reliability-optimal corner: every gentler back-off and every faster recovery bought 5-20% wall-clock
for a worse worst-case success rate. Halving stays.

Recovery is the one knob the sweep argued against leaving fixed. A step of 1 req/s takes 25
intervals to undo one halving of the 50/s tier and a single interval to undo it on the 6/s tier, so
the tier a client uses decides how long a stray 429 costs it. Measured on one uncontended client
that meets a single 429 early in a 600-request run: a fixed step of 1 turns an 11.2s run into 17.2s,
where not adapting at all costs 0.8s. The default step is therefore a twenty-fifth of the bucket's
rate, at least 1 — 2/s on the 50/s tier, 1/s on the small ones. That halves the stray-429 cost to
+3.9s, leaves the fleet success rates unchanged to within 0.1 point, and finishes the fleet runs
4-12% sooner. It does widen the spread between instances at 8 and 16, which is the fairness cost of
the larger step.

We also tested spreading the recovery interval across instances, on the theory that they recover in
lockstep and overshoot together. It moved the 429 count by at most 10%, inside the run-to-run
spread, and would have made the limiter's behaviour depend on a random source. Rejected.

## Decision

Admission control moves behind a `RateLimiter` interface (`acquire(context)`, optional
`recordResponse(context, response)` and `release(context)`) with an in-memory implementation as the
default. `context` carries the request path and query, the bucket the request draws from, and the
per-second rate the client would have applied on its own.

The default limiter adapts: on a throttled response a bucket's rate halves, and it recovers by a
twenty-fifth of the bucket's rate per quiet second. It is bounded on both sides, never above the
rate the client would have used anyway and never below a floor of one request per second, so it can
only ever make a client more conservative than it is today. It is on by default and switched off
with `rateLimit.adaptive: false`.

ADR-0017 supersedes the upper bound for the Content API client: where the CDN is observably serving
the traffic, the ceiling rises above the tier limit rather than sitting on it. Everything else here
stands.

Admission happens around each HTTP request rather than around the call that triggered it. Retries
are issued inside a single call, so gating the call would let one admitted request put
`retry.limit + 1` requests on the wire — up to 13 for the Management API's default — precisely
during the 429 storm the limiter exists to damp. Placing it at the same boundary also gives every
request its own context object, which a limiter needs to pair a release to its acquire.

Responses reach the limiter from that same boundary. The call site only ever sees the last response
of a request; the 429s a retry replaced are most of the signal, and they are exactly the ones it
would miss.

Passing `rateLimit.limiter` replaces the in-memory default outright. A fleet sharing a token holds
itself to one quota by pointing every instance at the same Redis or Upstash bucket, dividing
`context.limit` by the instance count, or whatever else fits the deployment.

## Consequences

- Clients sharing a token degrade instead of failing, without configuration.
- Adaptation reacts rather than prevents: the first overrun still happens, and a fleet that must
  never be throttled needs a shared limiter.
- Under adaptation instances converge unevenly, so one can finish well after another. For a build
  fleet total time is what matters, so the spread is acceptable; the per-arm numbers are above.
- A custom limiter is on the critical path of every request. Its `acquire` is awaited with no
  timeout of its own, so one that can stall must impose its own deadline. Failures from the two
  reporting hooks are swallowed, because a blip in shared storage must not turn a served request
  into an error or, inside the retry loop, into another request.
- The interface is public API, so its shape is now a compatibility commitment.
- `limiter.ts` and `throttle.ts` are duplicated verbatim between the two clients, which keeps them
  free of a shared runtime dependency at the cost of applying every change twice.
