# ADR-0001: No Shared Dependency Between API Clients

**Status:** Accepted  
**Date:** 2026-03-31

## Context

`@storyblok/management-api-client` (mapi-client) and `@storyblok/api-client` (capi-client) share a small amount of utility code: a `ClientError` class, a concurrency throttle, and a rate-limit header parser.

## Decision

Duplicate the shared code into each package rather than extracting it into a shared dependency.

## Alternatives Considered

- **Direct dependency** — mapi-client depends on capi-client. Creates a coupling between two packages with different release cadences and audiences. A breaking change in capi-client would force a mapi-client release.
- **Shared utility package** (e.g. `@storyblok/utils`, `@storyblok/concurrency`) — Adds another package to maintain, version, and publish for roughly 80 lines of stable, rarely-changing code. The overhead is not justified at this scale.

## Consequences

- Each client can evolve its throttling and error handling independently.
- Small amount of duplicated code (~80 LOC) that must be updated in both places if the logic changes.
- If the shared surface grows significantly in the future, extracting a utility package should be reconsidered.
