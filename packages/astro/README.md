<div align="center">

![Storyblok ImagoType](https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png)

<h1 align="center">@storyblok/astro</h1>
 <p>
     Block registry, Visual Editor middleware, and Live Preview DOM bridge for rendering <a href="https://www.storyblok.com/docs/api/content-delivery/v2" target="_blank">Storyblok</a> content in Astro.
  </p>
  <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/@storyblok/astro">
    <img src="https://img.shields.io/npm/v/@storyblok/astro/latest.svg?style=flat-square&color=8d60ff" alt="Storyblok Astro SDK" />
  </a>
  <a href="https://npmjs.com/package/@storyblok/astro" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/@storyblok/astro.svg?style=appveyor&color=8d60ff" alt="npm">
  </a>
  <a href="https://storyblok.com/join-discord">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a><br/>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok/astro">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-8d60ff?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## Features

- Independent, closure-scoped block registries via `defineStoryblokBlocks({ components, fallback })`
  — call it more than once for separate registries that never share state
- `StoryblokBlock` for rendering single or nested blocks
- Visual Editor integration using `storyblokEditable`
- Real-time Live Preview via `storyblokPreviewMiddleware`, `getPayload`, and `StoryblokPreview`
- Render rich text content with the Storyblok Rich Text Renderer based on `@storyblok/richtext`
- Built-in TypeScript support with comprehensive type definitions
- SSR/SSG compatibility for Astro applications

## Usage

```bash
pnpm add @storyblok/astro
```

`astro` is a peer dependency.

Register your components once, then render blocks anywhere:

```astro
---
// src/storyblok.ts
import { defineStoryblokBlocks } from '@storyblok/astro';
import Page from '~/components/Page.astro';
import Feature from '~/components/Feature.astro';

export const { StoryblokBlock } = defineStoryblokBlocks({
  components: { page: Page, feature: Feature },
});
```

```ts
// src/middleware.ts
import { sequence } from "astro:middleware";
import { storyblokPreviewMiddleware } from "@storyblok/astro";

export const onRequest = sequence(storyblokPreviewMiddleware);
```

```astro
---
// src/pages/index.astro
import { getPayload, StoryblokPreview } from '@storyblok/astro';
import { StoryblokBlock } from '~/storyblok';
import { client } from '~/lib/storyblok-client';

const payload = await getPayload({ locals: Astro.locals });
const story = payload.story ?? (await client.stories.get('home')).data.story;
---

<StoryblokBlock block={story.content} />
<StoryblokPreview />
```

`getPayload` returns the draft story posted by the Visual Editor, or nothing outside the editor — so
the same page serves preview and published content. Fetching stories is not this package's job:
bring your own client, e.g.
[`@storyblok/api-client`](https://www.npmjs.com/package/@storyblok/api-client).

### Component props

Every registered component receives `block` (the block's content) and `editable` (spread onto the
root element for the Visual Editor):

```astro
---
import type { StoryblokBlockComponentProps } from '@storyblok/astro';

type Props = StoryblokBlockComponentProps<{ headline: string }>;
const { block, editable } = Astro.props;
---

<div {...editable}>{block.headline}</div>
```

Unlike `@storyblok/react`'s `defineStoryblokBlocks<TExtraProps>()`, Astro components cannot be
generic, so extra props accepted by a block component are typed as `Record<string, any>` with no
excess-property checking.

To render a list of nested blocks, such as a `body` field, map over it with `StoryblokBlock`:

```astro
---
import type { StoryblokBlockComponentProps, StoryblokBlockData } from '@storyblok/astro';
import { StoryblokBlock } from '~/storyblok';

type Props = StoryblokBlockComponentProps<{ body: StoryblokBlockData[] }>;
const { block } = Astro.props;
---

{block.body?.map((child) => <StoryblokBlock block={child} />)}
```

### Rich text

`StoryblokRichText` renders a Storyblok rich text field. A `blok` node (an embedded block field) has
no generic HTML representation, so — like `@storyblok/richtext`'s `renderRichText` — it always needs
a renderer supplied through `components.blok`:

```astro
---
// src/components/EmbeddedBlok.astro
import type { StoryblokAstroRichTextProps } from '@storyblok/astro';
import { StoryblokBlock } from '~/storyblok';

type Props = StoryblokAstroRichTextProps<'blok'>;
const { attrs } = Astro.props;
---

{attrs.body?.map((block) => <StoryblokBlock block={block} />)}
```

```astro
---
import { StoryblokRichText } from '@storyblok/astro';
import EmbeddedBlok from '~/components/EmbeddedBlok.astro';
---

<StoryblokRichText document={block.text} components={{ blok: EmbeddedBlok }} />
```

Without `components.blok`, embedded blocks are skipped and a warning is logged — there's nothing
sensible to fall back to. `components` also lets you override the renderer for any other rich text
element (`heading`, `paragraph`, `code_block`, …); see
[`@storyblok/richtext`](https://www.npmjs.com/package/@storyblok/richtext) for the full node set.

## API

| Export                                            | Description                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `defineStoryblokBlocks({ components, fallback })` | Registers the block → component map and returns `StoryblokBlock`.                   |
| `StoryblokBlock`                                  | Renders one block, resolving its component from the registry.                       |
| `storyblokPreviewMiddleware`                      | Astro middleware that captures the Visual Editor preview payload on `Astro.locals`. |
| `getPayload({ locals })`                          | Reads that payload back.                                                            |
| `StoryblokPreview`                                | Client island that morphs the DOM as the editor types. Renders no markup.           |
| `StoryblokServerData`                             | Passes server-fetched data through live preview updates so edits don't lose it.     |
| `StoryblokRichText`                               | Renders a Storyblok rich text field.                                                |
| `storyblokEditable`                               | Re-export of the Storyblok helper for Visual Editor attributes.                     |
| `isInEditor`                                      | Checks whether a request came from the Visual Editor.                               |

Types: `StoryblokBlockData`, `StoryblokBlockComponentProps<T, TExtra>`, `StoryblokComponentMap`,
`DefineStoryblokBlocksOptions`, `StoryblokEditableProps`.

Blocks with no matching component render nothing and log a warning in development. Pass `fallback`
to render a placeholder instead.

## Live Preview behaviour

- The bridge is debounced by 500ms and aborts in-flight requests.
- If the Visual Editor has a focused element, only that element is morphed; its interactive state
  (`value`, `checked`, …) is preserved.
- Elements carrying `data-preserve-state` are never replaced.
- Opt out per page by not rendering `<StoryblokPreview />` there.
- Events: `storyblok-live-preview-updating` (cancelable) and `storyblok-live-preview-updated`.

## Documentation

For complete documentation, please visit
[package reference](https://www.storyblok.com/docs/packages/storyblok-astro).

## Contributing

If you'd like to contribute, please refer to the [contributing guidelines](CONTRIBUTING.md).

## Community

For help, discussion about best practices, or any other conversation that would benefit from being
searchable:

- [Discuss Storyblok on GitHub Discussions](https://github.com/storyblok/monoblok/discussions)

For community support, chatting with other users, please visit:

- [Discuss Storyblok on Discord](https://storyblok.com/join-discord)

## Support

For bugs or feature requests, please
[submit an issue](https://github.com/storyblok/monoblok/issues/new/choose).

> [!IMPORTANT] Please search existing issues before submitting a new one. Issues without a minimal
> reproducible example will be closed.
> [Why reproductions are Required](https://antfu.me/posts/why-reproductions-are-required).

### I can't share my company project code

We understand that you might not be able to share your company's project code. Please provide a
minimal reproducible example that demonstrates the issue by using tools like
[Stackblitz](https://stackblitz.com) or a link to a GitHub repo. Please make sure you include a
README file with the instructions to build and run the project, important not to include any access
token, password or personal information of any kind.

### Feedback

If you have a question, please ask in the
[Discuss Storyblok on Discord](https://storyblok.com/join-discord) channel.

## License

[License](/LICENSE)
