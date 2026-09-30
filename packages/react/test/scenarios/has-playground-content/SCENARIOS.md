# @storyblok/react Scenarios

| Scenario                 | Seeds                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `has-playground-content` | 6 components and 4 stories mirroring what `playground/integration-tests` renders: `home` and two article stories. |

The playground registers each component by name in `defineStoryblokBlocks({ components: {...} })`,
so the component names here (`page`, `teaser`, `feature`, `grid`, `featured-articles`) match its
registered keys. `article` has no rendering component on purpose: the two article stories exist only
as relation targets that `featured-articles` renders from the resolved story object (`name`,
`full_slug`).

`featured-articles.posts` holds the _local_ story UUIDs; the field is an `options` field with
`source: internal_stories`, so `storyblok stories push` remaps them to the remote UUIDs.

`packages/react/playground/integration-tests/schema/blocks.ts` defines the same shapes with
`@storyblok/schema`, so the app's API client and components are typed against them. It is the typing
source of truth; keep this JSON in sync with it by hand — `defineBlock` output is a DSL object, not
the MAPI wire shape the CLI push expects, so there is no generator between the two.
