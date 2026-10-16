# ADR-0020: Drop Astro 4.x from `@storyblok/astro`'s Peer Range

**Status:** Accepted **Date:** 2026-10-13

## Context

`<StoryblokPreview />` needs to warn when it's rendered on a prerendered route: a prerendered route
serves static HTML regardless of what the Visual Editor's POST sends, so Live Preview silently does
nothing there. The only way to detect that from inside the component is `Astro.isPrerendered`.

This ADR originally raised the peer range's floor to `^4.14.0`, on the assumption that
`Astro.isPrerendered` was available from Astro 4.14 (September 2024) onward. That assumption was
wrong: `Astro.isPrerendered` on the public `APIContext`/`Astro` global is only available from Astro
**5.0.0**. Astro 4.14.0 has no trace of it at all, and even the last 4.x release (4.16.19) only
threads an internal `isPrerendered` boolean through `RenderContext.createAPIContext()` — it never
reaches the public `Astro` global. Checked directly against the published npm tarballs for
`astro@4.14.0`, `astro@4.16.19`, and `astro@5.0.0`.

Practically, this means on every 4.x release the `import.meta.env.DEV && Astro.isPrerendered` check
in `StoryblokPreview.astro` reads `undefined`, so the prerender warning silently never fires — the
exact failure the original ADR was trying to avoid, just confined to 4.x instead of pre-4.14.

Astro 4 also hoists `<script>` tags along the static import graph rather than per-component, unlike
5.18+ and 7.3, which only emit a component's script when it's actually rendered. So on Astro 4, any
page that imports anything from `@storyblok/astro` ships the `<storyblok-preview>` custom-element
script (~5.8 KB gz) even on pages that never render `<StoryblokPreview />`.

This landed alongside other breaking `@storyblok/astro` changes already queued for its next major,
so there was room to reconsider the floor of the peer range instead of carrying a non-functional
compatibility branch.

npm's weekly download split by major (`astro` package, pulled via the npm download-counts API)
showed:

| Major | Downloads/week | Share |
| ----- | -------------- | ----- |
| 3.x   | 11,484         | 0.15% |
| 4.x   | 185,737        | 2.5%  |
| 5.x   | 1,496,409      | 20.4% |
| 6.x   | 987,612        | 13.5% |
| 7.x   | 4,604,172      | 62.9% |

Astro 3 and 4 combined are under 3% of downloads, and the 4.x share gets nothing from
`@storyblok/astro` in return for staying in the peer range: no working prerender warning, and a
script payload tax every Astro-4 page pays regardless of whether it uses Live Preview.

## Decision

Bump the peer range's floor to `^5.0.0 || ^6.0.0 || ^7.0.0`, dropping Astro 3 and all of Astro 4,
and read `Astro.isPrerendered` directly in `StoryblokPreview.astro` with no feature-detection
fallback.

## Alternatives Considered

- **Keep the `^4.14.0` floor from the original ADR** — Rejected: it doesn't buy anything.
  `Astro.isPrerendered` isn't public until 5.0.0, so the warning never fires on any 4.x release
  regardless of the floor's exact value, while Astro 4's script-hoisting still taxes every page with
  the preview script. A floor that trades compatibility for a feature it can't deliver has no upside
  over dropping the major outright.
- **Feature-detect with `Astro.isPrerendered ?? false`, keep a wider range including 4.x** — Works,
  but permanently no-ops the warning for all of Astro 4 (not just pre-4.14, since the API isn't
  public until 5.0.0), carries a version-specific comment to explain the guard, and keeps supporting
  two majors (3.x, 4.x) at under 3% combined download share with no feature to show for it.

## Consequences

- `StoryblokPreview.astro` reads `Astro.isPrerendered` unconditionally; no fallback or
  version-specific comment to maintain.
- Astro 3 and Astro 4 users must upgrade to Astro 5+ to use this major of `@storyblok/astro`.
- Astro-4 users no longer pay the `<storyblok-preview>` script-hoisting tax from importing
  `@storyblok/astro`, since they can't install this major at all.
- Future Astro-version-gated features can keep raising the floor instead of accumulating
  feature-detection branches, as long as the dropped range stays similarly marginal.
