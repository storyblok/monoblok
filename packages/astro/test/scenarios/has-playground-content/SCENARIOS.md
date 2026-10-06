# @storyblok/astro Scenarios

| Scenario                 | Seeds                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `has-playground-content` | 6 components and 5 stories mirroring what `playground/ssr` and `playground/ssg` render: `home`, `test`, and two articles. |

The playgrounds register every component explicitly via `defineStoryblokBlocks` in each playground's
`src/storyblok.ts`, so the component names here match the keys used there (`featured-articles` →
`FeaturedArticles.astro`). `article` has no Astro component on purpose: the articles exist only as
relation targets that `FeaturedArticles.astro` renders from the resolved story object (`name`,
`full_slug`).

`test` exists because `playground/ssr/src/pages/[...slug].astro` skips rendering
`<StoryblokLivePreview />` for the slugs `test`, `about-us`, and `contact` to opt them out of live
preview.

`featured-articles.posts` holds the _local_ story UUIDs; the field is an `options` field with
`source: internal_stories`, so `storyblok stories push` remaps them to the remote UUIDs.
