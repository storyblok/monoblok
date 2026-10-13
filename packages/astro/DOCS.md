# @storyblok/astro docs

Drafted docs for the v11 rewrite of `@storyblok/astro` (the new block-registry SDK). Ready to paste
into the docs platform.

**Before merging this PR:**

1. Open a docs-platform PR that:
   - Renames the current `src/content/docs/docs/libraries/js/astro-sdk/index.mdx` to `v8.mdx` (no
     content changes — it already documents 8.x through the last pre-rewrite release). Its own
     "Previous versions" link to `v7.mdx` stays as-is.
   - Adds the content below as the new `index.mdx`.
2. Link that PR here, then delete this file.

<!-- target: src/content/docs/docs/libraries/js/astro-sdk/index.mdx -->

````mdx
---
title: "@storyblok/astro (Version 11.x)"
description: "@storyblok/astro is Storyblok's official SDK for Astro applications."
---

import { Aside, LinkCard } from "@astrojs/starlight/components";

[@storyblok/astro](https://github.com/storyblok/monoblok/tree/main/packages/astro) is Storyblok's
official SDK for Astro applications. It provides a block registry, Visual Editor middleware, and a
Live Preview DOM bridge for rendering Storyblok content in Astro.

<Aside type="caution">
  Version 11 is a breaking rewrite. It replaces the `storyblok` Astro integration,
  `useStoryblokApi`, and `StoryblokComponent` with a block registry built around
  `defineStoryblokBlocks`. Fetching stories is no longer this package's responsibility: bring your
  own client, such as [`@storyblok/api-client`](/docs/libraries/js/content-delivery-api-client). See
  [previous versions](#previous-versions) for the 8.x-10.x API.
</Aside>

## Requirements

- **Astro** version 5.0 or later
- **Node.js** LTS (version 22.x recommended)
- **Modern web browser** (for example, Chrome, Firefox, Safari, Edge — latest versions)

## Installation

Add the package to a project by running this command in the terminal:

```bash
pnpm add @storyblok/astro
```

`astro` is a peer dependency.

## Usage

Register components once, then render blocks anywhere:

```ts title="src/storyblok.ts"
import { defineStoryblokBlocks } from "@storyblok/astro";
import Page from "~/components/Page.astro";
import Feature from "~/components/Feature.astro";

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: { page: Page, feature: Feature },
}));
```

`defineStoryblokBlocks` takes a factory, not the options object directly, so `components` is only
resolved the first time a block renders. Block components commonly import `StoryblokBlock` back from
this same module to recurse into `body` fields (see "Extra props" below), which makes this module
circular with every block it registers; passing a factory defers reading `Page`/`Feature` until that
cycle has finished initializing, instead of capturing them while still `undefined`.

`defineStoryblokBlocks` is closure-scoped: call it more than once (for example, once per content
area) to get independent registries that never share state or overwrite each other.

<Aside type="note">
  Components registered here must be `.astro` components. A framework component (React, Vue, ...)
  can't be registered directly: wrap it in an `.astro` component and apply the `client:*` directive
  there, the way the playgrounds' `ReactCounter.astro` wraps `Counter.jsx`.
</Aside>

Add the Visual Editor middleware so preview edits reach the page:

```ts title="src/middleware.ts"
import { sequence } from "astro:middleware";
import { storyblokPreviewMiddleware } from "@storyblok/astro";

export const onRequest = sequence(storyblokPreviewMiddleware);
```

Read the preview payload with `getPayload`, and render the story with `StoryblokBlock` and
`StoryblokPreview`:

```astro title="src/pages/index.astro"
---
import { getPayload, StoryblokPreview } from '@storyblok/astro';
import { StoryblokBlock } from '~/storyblok';
import { client } from '~/lib/storyblok-client';

const payload = await getPayload({ locals: Astro.locals });
const response = payload.story
  ? undefined
  : await client.stories.get('home', { query: { version: 'draft' } });
const story = payload.story ?? response?.data?.story;

if (!story) {
  throw new Error('Story not found');
}
---

<StoryblokBlock block={story.content} />
<StoryblokPreview />
```

`getPayload` returns the draft story posted by the Visual Editor, so the same page serves preview
and published content. `storyblokPreviewMiddleware` only captures it for same-origin, JSON POSTs
that carry the editor's query params, so in practice it stays empty outside the editor — this isn't
a hard guarantee against a same-origin script that deliberately replicates that request, only
against cross-site forgery. Request `version: 'draft'` from the fallback fetch too, or the first
(non-editor) load renders published content instead.

<Aside type="tip">
  `getPayload` only reads the payload the middleware captured; fetching stories is not this
  package's job. Bring your own client, such as
  [`@storyblok/api-client`](/docs/libraries/js/content-delivery-api-client).
</Aside>

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

<Aside type="note">
  `defineStoryblokBlocks<TExtraProps>()` type-checks extra props at the `<StoryblokBlock>` call
  site: a required field must be supplied, and an undeclared one is rejected. It does not check a
  registered component's own declared `Props` against that same `TExtraProps` — each `.astro`
  component's prop shape has to be kept in sync by hand.
</Aside>

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

Blocks with no matching component render nothing and log a warning in development. Pass `fallback`
to `defineStoryblokBlocks` to render a placeholder instead.

### Extra props

`defineStoryblokBlocks<TExtraProps>()` threads extra props through to every registered component and
onto `StoryblokBlock` itself:

```ts title="src/storyblok.ts"
import { defineStoryblokBlocks } from "@storyblok/astro";
import Branch from "~/components/Branch.astro";
import Leaf from "~/components/Leaf.astro";

type ExtraComponentProps = { locale: string };

export const { StoryblokBlock } = defineStoryblokBlocks<ExtraComponentProps>(() => ({
  components: { branch: Branch, leaf: Leaf },
}));
```

```astro title="src/components/Branch.astro"
---
import type { StoryblokBlockComponentProps, StoryblokBlockData } from '@storyblok/astro';
import { StoryblokBlock } from '~/storyblok';

type ExtraComponentProps = { locale: string };
type Props = StoryblokBlockComponentProps<{ body: StoryblokBlockData[] }, ExtraComponentProps>;
const { block, locale } = Astro.props;
---

{block.body?.map((child) => <StoryblokBlock block={child} locale={locale} />)}
```

```astro title="src/pages/index.astro"
---
import { StoryblokBlock } from '~/storyblok';
import { client } from '~/lib/storyblok-client';
import { getPayload } from '@storyblok/astro';

const payload = await getPayload({ locals: Astro.locals });
const response = payload.story
  ? undefined
  : await client.stories.get('home', { query: { version: 'draft' } });
const story = payload.story ?? response?.data?.story;

if (!story) {
  throw new Error('Story not found');
}
---

<StoryblokBlock block={story.content} locale="fr" />
```

A required field in `ExtraComponentProps` (`locale: string`) makes every `StoryblokBlock` usage,
including recursive ones like `Branch.astro`'s, supply it. An optional field (`locale?: string`)
stays optional. Since the registry lives in `src/storyblok.ts`, any component — not just the page —
can import `StoryblokBlock` from it to render its own children.

## Live preview

- `<StoryblokPreview />` always reloads the page on save/publish from the Visual Editor.
- Pass `liveUpdate` to also morph the DOM as the editor types, instead of waiting for save/publish.
- Render exactly one `<StoryblokPreview />` per page. A second instance throws in development and is
  a silent no-op in production.
- The live-morph bridge is debounced by 500ms and aborts in-flight requests.
- If the Visual Editor has a focused element, only that element is morphed; its interactive state
  (`value`, `checked`, …) is preserved.
- Elements carrying `data-preserve-state` are never replaced.
- Opt out of both behaviors per page by not rendering `<StoryblokPreview />` there.
- Events: `storyblok-live-preview-updating` (cancelable) and `storyblok-live-preview-updated`.

```astro
---
import { StoryblokPreview } from '@storyblok/astro';
---

<StoryblokPreview
  liveUpdate
  debounceMs={200}
  bridgeOptions={{ resolveRelations: ['featured.articles'] }}
/>
```

Live preview only works on an on-demand rendered route (`output: 'server'`, or a hybrid route
without `export const prerender = true`). A prerendered route serves static HTML regardless of what
the Visual Editor sends; `<StoryblokPreview />` logs a dev-only console warning when the route it's
rendered on is prerendered.

### `StoryblokServerData`

Pass server-fetched data through live preview updates so edits don't lose it. The data is sent once
and read back with `getPayload`:

```astro
---
import { getPayload, StoryblokServerData } from '@storyblok/astro';
import { getUsers } from '~/lib/getUsers';

interface ServerData {
  users: Awaited<ReturnType<typeof getUsers>>;
}

const payload = await getPayload<ServerData>({ locals: Astro.locals });
const users = payload.serverData?.users ?? (await getUsers());
---

<StoryblokServerData users={users} />
```

## Rich text

`StoryblokRichText` renders a Storyblok rich text field. A `blok` node (an embedded block field) has
no generic HTML representation, so — like `@storyblok/richtext`'s `renderRichText` — it always needs
a renderer supplied through `components.blok`:

```astro title="src/components/EmbeddedBlok.astro"
---
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

Without `components.blok`, embedded blocks are skipped and a warning is logged — there's nothing to
fall back to. `components` also overrides the renderer for any other rich text element (`heading`,
`paragraph`, `code_block`, and so on); see [`@storyblok/richtext`](/docs/libraries/js/rich-text) for
the full node set.

<Aside type="tip">
  Custom components are fully type-safe through `StoryblokAstroRichTextProps<T>`. For example,
  `StoryblokAstroRichTextProps<'link'>` exposes the `link` mark's attributes, and
  `StoryblokAstroRichTextProps<'heading'>` exposes `level`.
</Aside>

### Utility helpers

`@storyblok/astro` re-exports the core rich text utilities from `@storyblok/richtext` for advanced
custom components, such as custom image or table rendering:

- `renderRichText`: the core rich text rendering function.
- `buildStoryblokImage`: generates optimized Storyblok Image Service URLs.
- `splitTableRows`: splits table rows into `headerRows` and `bodyRows`.

## API reference

| Export                                                    | Description                                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `defineStoryblokBlocks(() => ({ components, fallback }))` | Registers the block → component map and returns `StoryblokBlock`.                        |
| `StoryblokBlock`                                          | Renders one block, resolving its component from the registry.                            |
| `storyblokPreviewMiddleware`                              | Astro middleware that captures the Visual Editor preview payload on `Astro.locals`.      |
| `getPayload({ locals })`                                  | Reads that payload back.                                                                 |
| `StoryblokPreview`                                        | Client island that reloads on save/publish, and morphs the DOM live with `liveUpdate`.   |
| `StoryblokServerData`                                     | Passes server-fetched data through live preview updates so edits don't lose it.          |
| `StoryblokRichText`                                       | Renders a Storyblok rich text field.                                                     |
| `storyblokEditable`                                       | Re-export of the Storyblok helper for Visual Editor attributes.                          |
| `isInEditor`                                              | Checks whether a request came from the Visual Editor.                                    |
| `sanitizeJSON`                                            | Safely serializes data for embedding in a `<script>` tag. Used by `StoryblokServerData`. |

Types: `StoryblokBlockData`, `StoryblokBlockComponentProps<T, TExtra>`,
`StoryblokBlockProps<TExtra>`, `StoryblokBlockComponent<TExtra>`, `StoryblokComponentMap`,
`DefineStoryblokBlocksOptions`, `DefineStoryblokBlocksResult<TExtra>`, `StoryblokEditableProps`,
`StoryblokPreviewProps`.

## Further resources

<LinkCard
  description="See the repository playground for additional examples."
  href="https://github.com/storyblok/monoblok/tree/main/packages/astro/playground"
  title="Repository Playground"
/>
<LinkCard
  description="Rich text renderer package for advanced functionality, including the rendering of native Astro components for nested rich text blocks."
  href="https://github.com/NordSecurity/storyblok-rich-text-astro-renderer"
  title="storyblok-rich-text-astro-renderer by NordSecurity"
/>
<LinkCard
  description="See the Astro guide for a comprehensive walkthrough on integrating Storyblok with Astro."
  href="/docs/quickstarts/astro"
  title="Astro Guide"
/>
<LinkCard
  description="See the core space blueprint for Astro to kickstart a new project."
  href="https://github.com/storyblok/blueprint-core-astro"
  title="Space Blueprint: Astro"
/>

## Previous versions

<LinkCard href="/docs/libraries/js/astro-sdk/v8" title="@storyblok/astro (Version 8.x)" />
````
