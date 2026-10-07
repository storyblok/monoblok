# @storyblok/astro Scenarios

| Scenario                 | Seeds                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `has-playground-content` | 6 components and 6 stories mirroring what `playground/ssr` and `playground/ssg` render: `home`, `test`, `about-us`, and two articles. |

The playgrounds register every component explicitly via `defineStoryblokBlocks` in each playground's
`src/storyblok.ts`, so the component names here match the keys used there (`featured-articles` →
`FeaturedArticles.astro`). `article` has no Astro component on purpose: the articles exist only as
relation targets that `FeaturedArticles.astro` renders from the resolved story object (`name`,
`full_slug`).

`test` exists because `playground/ssr/src/pages/[...slug].astro` skips rendering
`<StoryblokPreview />` for the slugs `test` and `contact`, opting them out of the preview bridge
entirely (no live DOM morphing, no reload on save/publish).

`about-us` exists for `playground/ssr/src/pages/about-us.astro`, a dedicated static route (Astro
resolves it ahead of `[...slug].astro`) that renders `<StoryblokPreview />` without `liveUpdate`:
the bridge stays attached, so saving/publishing still reloads the page, but typing never morphs the
DOM live.

`featured-articles.posts` holds the _local_ story UUIDs; the field is an `options` field with
`source: internal_stories`, so `storyblok stories push` remaps them to the remote UUIDs.
