# ADR-0012: The Experiments Factory Is a Stateless Config Binding

**Status:** Accepted
**Date:** 2026-08-04

## Context

`createExperiments` in `@storyblok/experiments` originally kept a `Map<number, Assignment>` in its closure: `resolveExperiment` wrote the visitor's assignment into it, and `track(name, props)` read it back to decide which experiment and variant the conversion belonged to. That made the factory an implicit per-request, per-visitor session.

Two consequences followed, both reported from a real Astro integration:

- **Conversions across requests recorded nothing.** In SSR, the render and the conversion are separate requests. The closure holding the assignment is garbage after the render, so `track` in a later request found an empty map and delivered no events. `track` was effectively callable only during render, which is not where conversions happen.
- **A shared instance misattributed.** The map is keyed by experiment id alone, so it cannot represent more than one visitor. Creating one instance at module scope, the natural thing to do with a factory that takes only config, made concurrent requests overwrite each other's assignment and attribute conversions to the wrong visitor.

The workaround, one factory per request, is both non-obvious and wasteful, and it still forbids the module-scope instance that the constructor's signature invites.

The decisive observation is that the map was never state. `assignVariant` is a pure function: it hashes `visitorId` plus the experiment id into a `0..99` bucket and walks the variants' cumulative weights. The same visitor resolves to the same variant on every call, in every process, forever. The map was a cache of a pure computation, and the cost of that cache was the entire request-boundary and cross-visitor problem.

## Decision

**The factory binds configuration and adapters. It holds no per-visitor state, and every visitor-specific operation takes `visitorId` as an explicit argument.**

1. **`track(goal, visitorId, options?)`.** The visitor is an argument, not remembered context. `track` recomputes the buckets from `visitorId`, so it works from any request, runtime, or instance, with no prior `resolveExperiment` call.
2. **`visitorId` is required on `Assignment` and `ExperimentEvent`.** An assignment is meaningless without the visitor it was computed for, and a sink cannot join a conversion to its exposure or count distinct visitors without it on the event.
3. **One instance at module scope is the documented pattern.** Since nothing per-visitor is retained, sharing an instance across concurrent requests is correct by construction, not by convention.
4. **Delivery is awaitable rather than injected.** `track` and `send` return promises; `resolveExperiment` stays synchronous (its result is what you render) and returns a `delivered` promise. Serverless callers hand that promise to `waitUntil`. The construction-time `waitUntil` option remains for per-request instances.
5. **The 1.x `track(goal, props?)` form stays, deprecated.** It is discriminated on `typeof` of the second argument, and the remembered map survives only to serve it. Both are marked for removal in 2.0 by a single comment block in `create-experiments.ts`.

## Alternatives Considered

- **Document "one factory per request" and leave the API alone.** Rejected: the constructor takes only config, so a module-scope instance will keep being written, and the failure is silent misattribution rather than an error. A design whose correct use cannot be inferred from its signature is the defect.
- **Key the remembered map by `visitorId` + experiment id.** Rejected: it fixes cross-visitor contamination but not the request boundary, since the closure still dies with the render. It also introduces unbounded growth on a long-lived instance, and any per-process cache is useless in the serverless environments the package targets, where consecutive requests land on different instances.
- **Persist assignments in a store (cookie, KV, database).** Rejected: it reintroduces the storage that deterministic bucketing exists to avoid, and buys nothing, since recomputing the bucket is a hash.
- **Deduplicate exposures in the SDK.** Rejected for the same reason: any cache is per-process, so it would be unreliable exactly where it matters while implying a guarantee the package cannot make. Exposures are delivered per `resolveExperiment` call and counted as distinct visitors in the sink.

## Consequences

- **Conversions work where they actually happen**, including a click handled by a different serverless invocation than the render.
- **A module-scope instance is safe and recommended**, which removes per-request construction from every framework integration.
- **`visitorId` becoming required is a type-level break** for code that hand-constructs an `Assignment` or an `ExperimentEvent`. Callers that obtain them from `assignVariant` or `resolveExperiment` are unaffected.
- **`track` records against every running experiment**, since it cannot know which one was rendered. Scoping conversions to visitors who saw an exposure is a join on `visitorId` in the sink.
- **The deprecated overload keeps one piece of per-visitor state alive** until 2.0, so "holds no per-visitor state" is true of the supported API but not yet of the implementation. The cleanup comment names all three pieces to remove together.
