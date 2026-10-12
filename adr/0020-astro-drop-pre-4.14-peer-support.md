# ADR-0020: Drop Astro Versions Before 4.14 from `@storyblok/astro`'s Peer Range

**Status:** Accepted **Date:** 2026-10-12

## Context

`<StoryblokPreview />` needed to warn when it's rendered on a prerendered route: a prerendered route
serves static HTML regardless of what the Visual Editor's POST sends, so Live Preview silently does
nothing there. The only way to detect that from inside the component is `Astro.isPrerendered`, which
Astro only added in 4.14 (September 2024).

`@storyblok/astro`'s peer range at the time was `^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0`, so
supporting the warning everywhere would have meant feature-detecting `Astro.isPrerendered` and
silently no-op'ing on versions that lack it.

This landed alongside other breaking `@storyblok/astro` changes already queued for its next major,
so there was room to reconsider the floor of the peer range instead of carrying a compatibility shim
indefinitely.

npm's weekly download split by major (`astro` package, pulled via the npm download-counts API)
showed:

| Major | Downloads/week | Share |
| ----- | -------------- | ----- |
| 3.x   | 11,484         | 0.15% |
| 4.x   | 185,737        | 2.5%  |
| 5.x   | 1,496,409      | 20.4% |
| 6.x   | 987,612        | 13.5% |
| 7.x   | 4,604,172      | 62.9% |

Astro 3 usage is negligible. Astro 4 as a whole is a small but non-trivial slice (2.5%); nothing in
the data splits out how much of that is pre- vs. post-4.14, but 4.14 was a patch-adjacent minor
release early in the 4.x line, so most active 4.x users are expected to already be past it.

## Decision

Bump the peer range's floor to `^4.14.0 || ^5.0.0 || ^6.0.0 || ^7.0.0`, dropping Astro 3 and Astro
<4.14 entirely, and read `Astro.isPrerendered` directly in `StoryblokPreview.astro` with no
feature-detection fallback.

## Alternatives Considered

- **Feature-detect with `Astro.isPrerendered ?? false`, keep the full `^3.0.0 || …` range** — Works,
  but permanently no-ops the warning for Astro 3 and early Astro 4 users, carries a version-specific
  comment to explain the guard, and keeps supporting a major (3.x) at 0.15% of downloads with no
  other reason to.
- **Keep Astro 3 in range, drop only pre-4.14 Astro 4** — Narrower peer ranges
  (`^3.0.0 || ^4.14.0 || ^5.0.0 || …`) are harder to express and reason about for marginal benefit,
  since Astro 3 usage is smaller than the undifferentiated pre-4.14 slice of 4.x.

## Consequences

- `StoryblokPreview.astro` reads `Astro.isPrerendered` unconditionally; no fallback or
  version-specific comment to maintain.
- Astro 3 and Astro <4.14 users must upgrade to use this major of `@storyblok/astro`.
- Future Astro-version-gated features can keep raising the floor instead of accumulating
  feature-detection branches, as long as the dropped range stays this marginal.
