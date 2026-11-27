<!--
Ships in 1.0.0. Per the docs platform versioning rule, the current page may need to be kept as
`v0.mdx` before these changes land in `index.mdx`.
-->

<!-- target: src/content/docs/docs/libraries/js/content-delivery-api-client/index.mdx#createapiclient -->
<!-- Replaces the `createApiClient()` options table; the `inlineRelations` and `fetch` rows change, and the `circularRelations` row is removed. -->

| Option            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessToken`     | **Required.** The Storyblok access token (preview or public).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `region`          | The API [region](#region). Possible values: `'eu'` (default), `'us'`, `'ap'`, `'ca'`, `'cn'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `baseUrl`         | A custom base URL that overrides the region-based URL (for example, when you route requests through a proxy).                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `headers`         | Additional headers to send with every request.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `throwOnError`    | If `true`, the client throws on HTTP errors instead of returning `{ error }`. Defaults to `false`.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `inlineRelations` | If `true`, the client replaces resolved relation UUIDs in story content with full story objects, up to two levels deep. Defaults to `false`. Refer to [inline relations](#inline-relations).                                                                                                                                                                                                                                                                                                                                                  |
| `inlineLinks`     | If `true`, the client adds each resolved link to its link field or rich text link as a `story` property. Defaults to `false`. Refer to [inline links](#inline-links).                                                                                                                                                                                                                                                                                                                                                                         |
| `cache`           | [Cache](#caching) configuration object.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `retry`           | [Retry](#retry) configuration object.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `rateLimit`       | [Rate-limiting](#rate-limiting) configuration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `timeout`         | Request timeout in milliseconds. Defaults to `30_000`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `fetch`           | A custom `fetch` implementation to use instead of the global `fetch`. Useful for testing or platform-specific fetch wrappers. The client learns the current `cv` from the final `response.url` a request was redirected to, so a wrapper must return the original `Response`. A rebuilt one loses the URL; then only story responses teach a `cv`, and an app that reads no stories caches with the TTL alone. This includes `new Response(body, init)` in a wrapper or response interceptor, and Next.js `cacheComponents` prerender caches. |

<!-- target: src/content/docs/docs/libraries/js/content-delivery-api-client/index.mdx#inline-relations -->
<!-- Replaces the last item of the "When enabled:" list (`Stories that reference each other…`). -->

- Related stories are inlined up to two levels deep, and the result is never circular. Refer to
  [relation depth](#relation-depth).

<!-- target: src/content/docs/docs/libraries/js/content-delivery-api-client/index.mdx#inline-relations -->
<!-- Removes the caution aside about cyclic object references, including both `devalue` examples. -->

<!-- target: src/content/docs/docs/libraries/js/content-delivery-api-client/index.mdx#circular-relations -->
<!-- Replaces the whole "Circular relations" section, heading and badge included. -->

## Relation depth

With `inlineRelations: true`, the client inlines the relations of the requested stories and the
relations of those related stories, the same way `storyblok-js-client` does. Relations one level
deeper stay UUID strings, so the result is never circular. `JSON.stringify` and framework features
that serialize data as JSON (such as Astro island props or Next.js Pages Router props) accept every
result.

For example, if story A references story B and story B references story A, the client inlines story
B into story A and a copy of story A into story B. The relation field of that copy keeps the UUID of
story B.

To read a story below the inlined levels, look up its UUID in the `rels` array of the response. If
the story isn't in `rels`, fetch it with the `by_uuids` query parameter of
[`client.stories.list()`](#clientstorieslist).

<!-- target: src/content/docs/docs/libraries/js/content-delivery-api-client/index.mdx#caching -->
<!-- Replaces the `cache` options table; the `cv` and `flush` rows change. -->

| Option                | Description                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provider`            | A custom cache provider. Defaults to an in-memory LRU cache (`maxEntries: 1_000`). See [Custom cache provider](#custom-cache-provider).                                                                                                                                                                                                                                   |
| `strategy`            | A cache strategy name or custom handler function. Defaults to `'cache-first'`. See [Cache strategies](#cache-strategies).                                                                                                                                                                                                                                                 |
| `ttlMs`               | Cache entry time-to-live in milliseconds. Defaults to `60_000`.                                                                                                                                                                                                                                                                                                           |
| `cv`                  | Controls the `cv` (content version) query parameter. `'auto'` (default) attaches the tracked `cv` to published requests, so the CDN serves them from its cache, and with `flush: 'auto'` checks it against the API at most once a minute. `'manual'` omits it (the client still tracks `cv` internally), useful for SSR with edge caching where stable URLs are required. |
| `flush`               | `'auto'` (default) flushes the cache when the API returns a new content version. `'manual'` requires calling `client.flushCache()` explicitly, and turns off the once-a-minute `cv` check. See [Cache flush control](#cache-flush-control).                                                                                                                               |
| `onRevalidationError` | Called when SWR background revalidation fails. Only relevant when `strategy` is `'swr'`. Defaults to `console.warn`.                                                                                                                                                                                                                                                      |

<!-- target: src/content/docs/docs/libraries/js/content-delivery-api-client/index.mdx#cache-strategies -->
<!-- Inserted after the custom handler example. -->

A custom handler that returns `cachedResult` whenever there is one, like the example above, never
sends the once-a-minute check described in [Cache flush control](#cache-flush-control), so it shows
published changes only once a cached response's TTL expires.

<!-- target: src/content/docs/docs/libraries/js/content-delivery-api-client/index.mdx#cache-flush-control -->
<!-- Inserted after the first paragraph ("By default (`flush: 'auto'`)…"). -->

The CDN keeps serving the snapshot of a `cv` it holds after content is published. With `cv: 'auto'`
and `flush: 'auto'`, the client therefore sends a published request for stories or links without the
`cv` at most once a minute, even if the cache holds a response for it. The API redirects that
request to the current `cv`, so the client picks up published changes without polling the spaces
endpoint or calling `client.flushCache()`.

- With `'cache-first'` and `'network-first'`, that request waits for the network. If it fails with a
  network error, a 5xx, 408, 413 or 429 once its retries are exhausted, the client returns the
  cached response; any other error, such as a 404, is returned as usual.
- With `'swr'`, the request runs as the background revalidation, so the changes appear one request
  later.
- A custom strategy handler decides whether that request uses the network.
- With `flush: 'manual'`, the client sends no such request.

Clients that share a cache provider object send one such request a minute. Clients with separate
provider objects over one store, such as a Redis client per request, share it once it was answered;
requests racing at the minute mark can each send one.

<!-- target: src/content/docs/docs/libraries/js/content-delivery-api-client/index.mdx#cache-flush-control -->
<!-- Inserted as a new `### Cost and migration` section after "Cache flush control". -->

### Cost and migration

Since 1.0.0, the once-a-minute check costs about one redirected request a minute for each cache: per
process or serverless instance with the default in-memory cache, or per shared provider. It's sent
even when every response is cached.

- If you invalidate from a Storyblok webhook, set `flush: 'manual'` and call `client.flushCache()`
  from the webhook. That turns the check off.
- If you poll `client.spaces.get()` or read drafts, those still notice published changes as before;
  the check is the fallback when neither happens.
- A job that runs longer than a minute, such as a static build, can see changes published while it
  runs. Set `flush: 'manual'` to keep the content of one run consistent.

<!-- target: src/content/docs/docs/libraries/js/content-delivery-api-client/index.mdx#rate-limiting -->
<!-- Replaces the `maxConcurrency` row of the `RateLimitConfig` table. -->

| Property            | Default  | Description                                                                                                                            |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `requestsPerSecond` | Per tier | Fixed number of requests to start per second. Setting it disables tier detection, and all requests share this limit. Capped at `1000`. |
