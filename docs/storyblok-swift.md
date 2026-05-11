# Storyblok Swift Repository

URLSession extension for Storyblok APIs. Supports macOS 13+, iOS 16+, tvOS 16+, watchOS 9+. Single-file implementation.

## When to explore storyblok-swift

- Ensuring API parity between JS and Swift SDKs
- Understanding the URLSession extension pattern for rate limiting and caching
- Verifying Apple platform SDK behavior against Storyblok APIs

## Key details

- Rate limiting via KVO task state observation: CDN 1000 rps, MAPI 6 rps
- Exponential backoff: `min(2^failCount, 60) + random(0,1)` on 429/5xx
- CV parameter auto-extracted from 301 redirects
- Cache: `returnCacheDataElseLoad` for published, no cache for draft
- Combine support via `failOnErrorResponse` operator
