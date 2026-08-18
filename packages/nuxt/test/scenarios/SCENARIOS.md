# @storyblok/nuxt Scenarios

| Scenario                 | Seeds                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `has-playground-content` | 8 components and 7 stories mirroring the content tree the `playground/` app expects: the `vue` folder and start page, `vue/test`, `vue/test-richtext`, and the `vue/articles` folder with two articles. |

The playground's slugs are hardcoded (`useAsyncStoryblok("vue", ...)`, `` `vue/articles/${slug}` ``,
`"vue/test-richtext"`), so this scenario mirrors them exactly and the playground needs no code
change. Point it at the QA space with `NUXT_PUBLIC_STORYBLOK_ACCESS_TOKEN`, which overrides the
committed demo token because the module assigns `runtimeConfig.public.storyblok` wholesale.

The `popular-articles` block's `articles` field holds the _local_ story UUIDs. The field is an
`options` field with `source: internal_stories`, so `storyblok stories push` remaps those to the
UUIDs it assigns remotely; no post-seed linking step is needed.
