# Storyblok Kotlin Repository

Kotlin Multiplatform Ktor client plugin for Storyblok APIs. Supports all KMP targets (JVM, Android, JS, Wasm, iOS, macOS, tvOS, watchOS, Linux, Windows).

## When to explore storyblok-kotlin

- Ensuring API parity between JS and Kotlin SDKs
- Understanding the Ktor plugin pattern for rate limiting, retry, and caching
- Verifying mobile SDK behavior against Storyblok APIs

## Key details

- `explicitApi()` enforced — all public declarations need explicit visibility/return types
- Binary compatibility tracked via `abiValidation` — CI enforces on main
- Auto rate limiting: CDN 1000 rps, MAPI 6 rps with atomic backoff
- Retry: up to 5 on 429/5xx with exponential backoff
- CV parameter auto-extracted from 301 redirects
