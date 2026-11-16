# @storyblok/astro Scenarios

| Scenario                 | Seeds                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `has-playground-content` | 8 components and 7 stories for `playground/integration-tests`: `home`, `test`, `about-us`, two articles, and `hydration`. |

The playground registers every component explicitly via `defineStoryblokBlocks` in its
`src/storyblok.ts`, so the component names here match the keys used there (`featured-articles` →
`FeaturedArticles.astro`). `article` has no Astro component on purpose: the articles exist only as
relation targets that `FeaturedArticles.astro` renders from the resolved story object (`name`,
`full_slug`).

`test` exists because `playground/integration-tests/src/pages/[...slug].astro` skips rendering
`<StoryblokPreview />` for the slugs `test` and `contact`, opting them out of the preview bridge
entirely (no live DOM morphing, no reload on save/publish).

`about-us` exists for `playground/integration-tests/src/pages/about-us.astro`, a dedicated static
route (Astro resolves it ahead of `[...slug].astro`) that renders `<StoryblokPreview />` without
`liveUpdate`: the bridge stays attached, so saving/publishing still reloads the page, but typing
never morphs the DOM live.

`hydration` is a regression scenario for client-directive islands introduced only by a live-preview
DOM morph: its `page` seeds one `load_counter` block (`client:load`, present from the first render).
`react_counter` (`client:visible`) is pushed as a component but never placed in any story's body —
the hydration spec adds it to the `hydration` page through the Visual Editor itself, to reproduce a
`client:visible` directive appearing for the first time only after a live-preview DOM morph.

`featured-articles.posts` holds the _local_ story UUIDs; the field is an `options` field with
`source: internal_stories`, so `storyblok stories push` remaps them to the remote UUIDs.
