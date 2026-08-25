# @storyblok/astro Scenarios

| Scenario                 | Seeds                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `has-playground-content` | 6 components and 5 stories mirroring what `playground/ssr` and `playground/ssg` render: `home`, `test`, and two articles. |

The playgrounds auto-register every component in `playground/shared/storyblok/` by filename, so the
component names here match those files (`featured-articles` → `FeaturedArticles.astro`). `article`
has no Astro component on purpose: the articles exist only as relation targets that
`FeaturedArticles.astro` renders from the resolved story object (`name`, `full_slug`).

`test` exists because `playground/ssr/src/pages/[...slug].astro` disables live preview for the slugs
`test`, `about-us`, and `contact` via `<meta name="storyblok-live-preview" content="disabled">`.

`featured-articles.posts` holds the _local_ story UUIDs; the field is an `options` field with
`source: internal_stories`, so `storyblok stories push` remaps them to the remote UUIDs.
