# ADR-0020: Pagination Walks

**Status:** Accepted  
**Date:** 2026-10-12

## Context

Every paginated resource of `@storyblok/api-client` and `@storyblok/management-api-client` returns
one page per `list()` call. Reading a whole collection meant a hand-rolled loop over `page`,
`per_page`, and the `Total` header. `storyblok-js-client` offers `getAll()`, which fetches page 1
and then all remaining pages concurrently into one array.

A walk over the Content Delivery API reads offsets. Offsets only line up if every page comes from
the same published snapshot, and a publish mid-walk moves the CDN to a new `cv` (see ADR-0018).

## Decision

**Paginated resources get two async generators next to `list()`: `pages()` and `iterate()`. Every
request goes through `list()`, so caching, throttling, and retries stay in one place.**

1. **`pages()` yields errors as values, `iterate()` throws.** `pages()` yields the `list()` envelope
   of each page, plus `page`, `perPage`, and `total`, and ends with a failed page's envelope, like
   `list()` resolves with `error`. With `throwOnError`, on the call or the client, it throws
   instead. `iterate()` yields items and has no envelope to carry an error, so it always throws.
2. **One failure type with a resume point.** A failed page becomes a `PaginationError` (a
   `ClientError`) with `page`, `reason` (`request`, `invalid-response`, `snapshot-changed`), the
   original `ClientError` as `cause`, and on the Content API client the `cv` to resume in. Transport
   failures are wrapped too, unlike in `list()`, so they keep the resume point. Aborting the
   caller's `signal` throws the abort reason unchanged.
3. **Content API walks are pinned.** A published walk pins every later page to the `cv` the first
   page was served from, read from the body or, for `/cdn/links`, from the redirected URL. A later
   page from a different `cv` fails with `snapshot-changed` and a `page` that restarts the walk. A
   walk resumed past page 1 must be served from the `cv` it resumes in. A walk from page 1 pins
   whatever `cv` the API serves, so a stale or made-up `cv` doesn't fail it. Draft walks and
   `cache.cv: 'manual'` are not pinned.
4. **Serial, with one page of lookahead.** `iterate()` fetches page n+1 while page n is consumed;
   `pages()` fetches only on demand, which suits "load more" UIs. There is no concurrency option.
   Pinning would make a `getAll()`-style fan-out after page 1 safe, so it stays open as an
   extension, but a serial walk is predictable under rate limits and stops at the first failure.
5. **The walk guards against bad pages.** It counts received items against `Total`, so a page the
   API capped below the requested `per_page` doesn't end it early. A page without a list of items,
   or one that repeats the previous page, fails with `invalid-response` instead of ending silently
   or looping forever.
6. **The walk code is duplicated per client**, as ADR-0001 decided for shared code. Within each
   client, `createPaginationMethods()` builds `pages()` and `iterate()` from a resource's `list()`
   and an item getter, so a resource adds only its wiring and JSDoc.

## Alternatives Considered

- **Standalone paginator functions** (`paginateStories(client, options)`, as in the AWS SDK v3).
  They tree-shake, but the clients expose resources as objects, so methods match the existing API.
  The walk adds about 1.2 KB gzip to each client whether or not it is used.
- **A shared package for the walk.** About 170 lines are identical between the clients. ADR-0001's
  reasons still hold: different release cadences, and a package to maintain for stable code.
- **Restarting automatically after a snapshot change.** It would hide that items already yielded
  came from the old snapshot. The caller decides whether to restart, deduplicate, or give up.
- **`toArray()`.** `Array.fromAsync()` covers it on Node.js 22 and later.

## Consequences

- Callers that branch on error types see a `PaginationError` from walks where `list()` with
  `throwOnError` rejects a raw `TimeoutError` or `TypeError`. The original error is
  `error.cause.cause`.
- The cache tags `/cdn/links` responses with the `cv` from the response URL, so a redirected
  response is tagged with the snapshot it was served from rather than the one requested.
- Changes to the walk must be made in both clients.
