# @storyblok/svelte Scenarios

| Scenario                 | Seeds                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `has-playground-content` | 6 components and 4 stories for the Svelte integration playground: `home` and two related articles under `articles`. |

The component names match the Svelte integration playground. `article` has no Svelte component on
purpose: the articles exist only as relation targets that `FeaturedArticles.svelte` renders from the
resolved story object (`name`, `full_slug`).

`featured-articles.posts` holds the _local_ story UUIDs; the field is an `options` field with
`source: internal_stories`, so `storyblok stories push` remaps them to the remote UUIDs.
