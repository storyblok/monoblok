---
title: "@storyblok/svelte"
description:
  "@storyblok/svelte renders Storyblok content in Svelte with a block registry, and connects pages
  to the Visual Editor for live preview."
---

# @storyblok/svelte

[@storyblok/svelte](https://github.com/storyblok/monoblok/tree/main/packages/svelte) renders
Storyblok content in Svelte. It maps Storyblok blocks to Svelte components with a block registry,
and connects pages to the [Visual Editor](https://www.storyblok.com/docs/concepts/visual-editor) for
live preview.

The package doesn’t fetch content. Fetch stories with your own client, such as
[@storyblok/api-client](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client),
and render them with the `StoryblokBlock` component returned by `defineStoryblokBlocks()`. Rich text
renders with the standalone `StoryblokRichText` component, which isn’t bound to a block registry.

To upgrade from version 7.x, follow the
[migration guide](https://www.storyblok.com/docs/libraries/js/svelte-sdk/migration-from-v7).

## Requirements

- **Svelte** version 5.25 or later
- **Node.js** LTS (version 22.x recommended)
- **Modern web browser** (for example, Chrome, Firefox, Safari, Edge—latest versions)

## Installation

Add the packages to a project by running this command in the terminal:

```bash
npm install @storyblok/svelte@latest @storyblok/api-client@latest
```

## Usage

The examples below use SvelteKit 2. The SDK itself has no SvelteKit dependency. SvelteKit 3 removed
the `$lib` alias: replace `$lib/...` with `#lib/...` in the imports, or add
`alias: { $lib: 'src/lib' }` to `svelte.config.js`.

### Configuration

Create an `@storyblok/api-client` instance with the space’s access token, and register the Svelte
components that render your Storyblok blocks:

```ts
// src/lib/storyblok.ts
import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/svelte";
import Page from "$lib/blocks/Page.svelte";
import Feature from "$lib/blocks/Feature.svelte";

export const apiClient = createApiClient({
  accessToken: "YOUR_ACCESS_TOKEN",
  region: "eu",
});

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: { page: Page, feature: Feature },
}));
```

Learn how to retrieve an access token in the
[access tokens concept](https://www.storyblok.com/docs/concepts/access-tokens). Set `region` to the
region the space was created in. It defaults to `eu`. Learn more in the
[@storyblok/api-client reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client).

### Components

Create a Svelte component for each block and register it in `defineStoryblokBlocks`. Each component
receives the block content as `block`, and its Visual Editor attributes as `editable`. Spread
`editable` onto the component’s root element to make the block selectable in the Visual Editor.

```svelte
<!-- src/lib/blocks/Feature.svelte -->
<script lang="ts">
  import type { StoryblokBlockComponentProps } from '@storyblok/svelte';

  const { block, editable }: StoryblokBlockComponentProps<{ name: string }> = $props();
</script>

<div {...editable}>
  <h2>{block.name}</h2>
</div>
```

To render nested blocks, import `StoryblokBlock` from the module that calls `defineStoryblokBlocks`:

```svelte
<!-- src/lib/blocks/Page.svelte -->
<script lang="ts">
  import type { StoryblokBlockComponentProps, StoryblokBlockData } from '@storyblok/svelte';
  import { StoryblokBlock } from '$lib/storyblok';

  const { block, editable }: StoryblokBlockComponentProps<{ body: StoryblokBlockData[] }> =
    $props();
</script>

<main {...editable}>
  {#each block.body as nestedBlock (nestedBlock._uid)}
    <StoryblokBlock block={nestedBlock} />
  {/each}
</main>
```

### Fetching and rendering

Fetch a story in a `load` function:

```ts
// src/routes/[...slug]/+page.ts
import { error } from "@sveltejs/kit";
import { apiClient } from "$lib/storyblok";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  const { data, error: apiError } = await apiClient.stories.get(params.slug || "home", {
    query: { version: "draft" },
  });
  if (apiError?.response.status === 404) error(404, "Story not found");
  // A wrong token or region, a rate limit, or a network failure: don't report it as a 404.
  if (!data) throw apiError ?? new Error("Failed to fetch story");

  return { story: data.story };
};
```

Render the story’s content with `StoryblokBlock`, and subscribe to Visual Editor changes with
`onStoryblokEditorEvent`:

```svelte
<!-- src/routes/[...slug]/+page.svelte -->
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onStoryblokEditorEvent } from '@storyblok/svelte';
  import type { LivePreviewStory } from '@storyblok/svelte';
  import { StoryblokBlock } from '$lib/storyblok';

  let { data } = $props();
  // Resets to the loaded story on navigation, and takes Visual Editor updates in between.
  let story = $derived<LivePreviewStory>(data.story);

  $effect(() =>
    onStoryblokEditorEvent((newStory) => (story = newStory), {
      onChange: () => invalidateAll(),
    }),
  );
</script>

<StoryblokBlock block={story.content} />
```

## API

### `defineStoryblokBlocks`

`defineStoryblokBlocks()` registers the components that render Storyblok blocks and returns the
`StoryblokBlock` component bound to them.

```ts
const { StoryblokBlock } = defineStoryblokBlocks<TExtraProps>(() => OPTIONS);
```

`defineStoryblokBlocks()` takes a function that returns the options, not the options object. Block
components that render nested blocks import `StoryblokBlock` back from the same module, which
creates an import cycle. The function runs on the first render, after the cycle has finished
loading.

| Key          | Description                                                                                                                   | Type      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------- |
| `components` | An object that maps the technical names of Storyblok blocks to Svelte components.                                             | `object`  |
| `fallback`   | A component rendered for block types that `components` doesn’t include. It receives the same props as a registered component. | `object`  |
| `warnings`   | Logs a warning when `StoryblokBlock` renders nothing. Defaults to `true`. Set it to `false` to silence the warnings.          | `boolean` |

Each call creates an independent registry. Nothing is shared globally, so an app can define one
registry per content area without the registries overwriting each other.

#### Unregistered blocks

A content editor can add a block type that no component is registered for. `StoryblokBlock` then
renders the `fallback`, or, without one, renders nothing and logs a warning. The warning is logged
in development and production, so missing content shows up in your logs. Each registry logs the
warning once per block type for the lifetime of the process, so a server logs it once per
deployment, not once per request. A framework that hydrates in the browser, such as SvelteKit, also
logs it in each visitor’s browser console. Set `warnings` to `false` to keep production consoles
clean.

To silence the warnings of a registry, set `warnings` to `false`:

```ts
export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: { page: Page },
  warnings: false,
}));
```

#### Extra props

Pass a type argument to declare props that `StoryblokBlock` forwards to every registered component:

```ts
export const { StoryblokBlock } = defineStoryblokBlocks<{ locale: string }>(() => ({
  components: { page: Page },
}));
```

```svelte
<StoryblokBlock block={story.content} locale="fr" />
```

A registered component can only require props declared in the type argument. The `block` and
`editable` names are reserved.

### `StoryblokBlock`

`StoryblokBlock` renders a block with the component registered for its `component` field. Pass the
block as the `block` prop, and any extra props declared in `defineStoryblokBlocks`.

```svelte
<StoryblokBlock block={story.content} />
```

The registered component receives:

| Prop       | Description                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `block`    | The block content.                                                                                |
| `editable` | The block’s Visual Editor attributes. Spread them onto the component’s root element.              |
| Extra      | The props declared in the `defineStoryblokBlocks` type argument, forwarded from `StoryblokBlock`. |

`StoryblokBlock` renders nothing for an undefined `block`, and logs a warning unless the registry
sets `warnings` to `false`. In the Visual Editor, `story.content` is `undefined` while the editor
shows a previous version of the story (visual history), so `StoryblokBlock` skips the warning there.

### `storyblokEditable`

`storyblokEditable()` takes a block and returns the attributes that make an element editable in the
Visual Editor. Registered components receive the same attributes as the `editable` prop. Use
`storyblokEditable()` for elements outside a registered component:

```svelte
<section {...storyblokEditable(block)}>{block.headline}</section>
```

### `editableField`

`editableField()` takes a field name and returns the attributes that link an element to that field
in the Visual Editor:

```svelte
<h2 {...editableField('headline')}>{block.headline}</h2>
```

### `onStoryblokEditorEvent`

`onStoryblokEditorEvent()` loads the Storyblok Bridge and calls a callback with the updated story
whenever an editor changes content in the Visual Editor. It returns an unsubscribe function right
away, so it can be returned from `$effect`. Outside the Visual Editor and on the server, the
function does nothing.

```ts
$effect(() => onStoryblokEditorEvent(CALLBACK, OPTIONS));
```

All [Storyblok Bridge options](https://www.storyblok.com/docs/libraries/js/preview-bridge) are
available, such as `resolveRelations` and `resolveLinks`. Pass the same values you use to fetch the
story, so updated content keeps its resolved relations and links. The following additional options
are available:

| Key        | Description                                                                                                                                          | Type       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `onChange` | Called when the story is saved or published, instead of reloading the page. In SvelteKit, pass `() => invalidateAll()` to rerun the `load` function. | `function` |
| `onError`  | Called if the Storyblok Bridge fails to load. Without it, the error is logged.                                                                       | `function` |

The callback receives every story the Visual Editor sends, not only the story of the current page.
All subscriptions on a page share one Storyblok Bridge, so the page reloads on save unless every
subscription passes `onChange`.

### `loadStoryblokBridge`

`loadStoryblokBridge()` loads the Storyblok Bridge and returns a new bridge instance. Use it to
listen to events that `onStoryblokEditorEvent()` doesn’t handle.

```ts
const bridge = await loadStoryblokBridge(BRIDGE_OPTIONS);
bridge.on("enterEditmode", () => {
  // ...
});
```

### `isInEditor`

`isInEditor()` takes a URL and returns `true` if the request comes from the Visual Editor. Pass a
`spaceId` option to also check that the request belongs to that space.

```ts
export const load: PageLoad = async ({ url }) => {
  const version = isInEditor(url) ? "draft" : "published";
  // ...
};
```

### `StoryblokRichText`

`StoryblokRichText` renders a rich text field from a Storyblok story. It renders embedded blocks
only through a `components.blok` renderer. Learn more in [Embedded blocks](#embedded-blocks).

```svelte
<script lang="ts">
  import { StoryblokRichText } from '@storyblok/svelte';
</script>

<StoryblokRichText document={block.richtext_field} />
```

The component accepts the following optional props:

- `components`: custom Svelte components for supported rich text nodes and marks.
- `optimizeImage`: image optimization options for image nodes.
- `data`: custom data passed to custom components through `context`.
- `warnings`: logs a warning for embedded blocks without a `components.blok` renderer. Defaults to
  `true`. Set it to `false` to silence it.

For a complete list of supported nodes, marks, and customization options, refer to the
[@storyblok/richtext reference](https://www.storyblok.com/docs/libraries/js/rich-text).

#### Custom components

Register custom components with the `components` prop. Each key must match a supported rich text
node or mark name.

```svelte
<script lang="ts">
  import type { StoryblokSvelteRichTextComponentMap } from '@storyblok/svelte';
  import { StoryblokRichText } from '@storyblok/svelte';
  import CustomHeading from './CustomHeading.svelte';
  import CustomLink from './CustomLink.svelte';

  const components: StoryblokSvelteRichTextComponentMap = {
    heading: CustomHeading,
    link: CustomLink,
  };
</script>

<StoryblokRichText document={block.richtext_field} {components} />
```

`StoryblokSvelteRichTextProps<T>` types the props of a custom component. For example,
`StoryblokSvelteRichTextProps<'link'>` provides the attributes of the `link` mark, and
`StoryblokSvelteRichTextProps<'heading'>` provides heading attributes such as `level`.

#### Example: custom link component (mark)

Marks receive their rendered child content through Svelte’s `{@render ...}` tag.

```svelte
<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '@storyblok/svelte';

  const props: StoryblokSvelteRichTextProps<'link'> = $props();
</script>

<a href={props.attrs?.href ?? ''} target={props.attrs?.target ?? '_self'}>
  {@render props.children?.()}
</a>
```

#### Example: custom heading component (node)

```svelte
<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '@storyblok/svelte';

  const props: StoryblokSvelteRichTextProps<'heading'> = $props();
  const tag = $derived(`h${props.attrs?.level ?? 1}`);
</script>

<svelte:element this={tag}>
  {@render props.children?.()}
</svelte:element>
```

#### Example: custom table component (advanced node)

Nodes can access `content` and `context` to render child nodes with `StoryblokRichText`. The
`splitTableRows` utility from `@storyblok/richtext` separates header rows from body rows. Install it
with `npm install @storyblok/richtext@latest`, because package managers such as `pnpm` don’t expose
the dependencies of `@storyblok/svelte` to your code.

```svelte
<script lang="ts">
  import { splitTableRows } from '@storyblok/richtext';
  import type { StoryblokSvelteRichTextProps } from '@storyblok/svelte';
  import { StoryblokRichText } from '@storyblok/svelte';

  const props: StoryblokSvelteRichTextProps<'table'> = $props();
  const { headerRows, bodyRows } = $derived(splitTableRows(props.content));
</script>

<table>
  {#if headerRows}
    <thead>
      <StoryblokRichText document={headerRows} {...props.context} />
    </thead>
  {/if}
  <tbody>
    <StoryblokRichText document={bodyRows} {...props.context} />
  </tbody>
</table>
```

#### Embedded blocks

Rich text fields can embed blocks. `StoryblokRichText` renders them through a `components.blok`
renderer, which receives the embedded blocks as `attrs.body`. Without one, embedded blocks render
nothing and log a warning. To silence the warning, pass `warnings={false}`.

To render embedded blocks with your registered components, create a `blok` renderer that renders
each block with your `StoryblokBlock`:

```svelte
<!-- src/lib/RichTextBlok.svelte -->
<script lang="ts">
  import type { StoryblokBlockData, StoryblokSvelteRichTextProps } from '@storyblok/svelte';
  import { StoryblokBlock } from '$lib/storyblok';

  const { attrs }: StoryblokSvelteRichTextProps<'blok'> = $props();
  const blocks: StoryblokBlockData[] = $derived(Array.isArray(attrs?.body) ? attrs.body : []);
</script>

{#each blocks as block (block._uid)}
  <StoryblokBlock {block} />
{/each}
```

Then pass it as `components.blok`:

```svelte
<script lang="ts">
  import { StoryblokRichText } from '@storyblok/svelte';
  import RichTextBlok from '$lib/RichTextBlok.svelte';
</script>

<StoryblokRichText document={block.text} components={{ blok: RichTextBlok }} />
```

### Types

`@storyblok/svelte` exports the following types.

| Type                                           | Description                                                                                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DefineStoryblokBlocksOptions`                 | Return value of the `defineStoryblokBlocks()` factory.                                                                                                      |
| `DefineStoryblokBlocksResult`                  | Return value of `defineStoryblokBlocks()`: `StoryblokBlock`.                                                                                                |
| `StoryblokBlockComponent`                      | A Svelte component that renders a block.                                                                                                                    |
| `StoryblokBlockComponentProps<T, TExtraProps>` | Props of a block component: `block`, `editable`, and the extra props. Pass the block’s fields as `T`: `StoryblokBlockComponentProps<{ headline: string }>`. |
| `StoryblokBlockData<T>`                        | A block’s content: the fields in `T` plus `component`, `_uid`, and `_editable`. Without a type argument, its fields are typed as `unknown`.                 |
| `StoryblokBlockProps`                          | Props of `StoryblokBlock`.                                                                                                                                  |
| `StoryblokComponentMap`                        | Map of technical block names to block components.                                                                                                           |
| `StoryblokEditableProps`                       | Return value of `storyblokEditable()`.                                                                                                                      |
| `StoryblokExtraProps`                          | Constraint for the `TExtraProps` type argument. Excludes `block` and `editable`.                                                                            |
| `StoryblokRichTextComponentProps`              | Props of `StoryblokRichText`.                                                                                                                               |
| `StoryblokSvelteRichTextComponentMap`          | Map of rich text node and mark names to custom components.                                                                                                  |
| `StoryblokSvelteRichTextProps<T>`              | Props of a custom rich text component for the node or mark `T`.                                                                                             |
| `StoryblokSvelteRichTextRenderContext`         | The `context` prop of a custom rich text component.                                                                                                         |
| `BridgeParams`                                 | Preview Bridge options, re-exported from `@storyblok/live-preview`.                                                                                         |
| `LivePreviewOptions`                           | Options of `onStoryblokEditorEvent`, re-exported from `@storyblok/live-preview`.                                                                            |
| `LivePreviewStory`                             | The story passed to the `onStoryblokEditorEvent` callback.                                                                                                  |
| `StoryblokEditorChangeEvent`                   | A Visual Editor change event, re-exported from `@storyblok/live-preview`.                                                                                   |

`@storyblok/svelte` also re-exports the rich text types of `@storyblok/richtext`, such as
`StoryblokRichTextNode` and `StoryblokRichTextImageOptions`.

## Further resources

- [@storyblok/api-client Package Reference](https://www.storyblok.com/docs/libraries/js/content-delivery-api-client)—Learn
  how to fetch content from the Content Delivery API in the @storyblok/api-client reference.
- [@storyblok/richtext Package Reference](https://www.storyblok.com/docs/libraries/js/rich-text)—Find
  the supported rich text nodes and marks in the @storyblok/richtext reference.
- [@storyblok/live-preview Package Reference](https://github.com/storyblok/monoblok/blob/main/packages/live-preview/docs/reference.md)—Learn
  how the live preview update works in the @storyblok/live-preview reference.
- [Migrate to @storyblok/svelte 8.x](https://www.storyblok.com/docs/libraries/js/svelte-sdk/migration-from-v7)—Upgrade
  an application from @storyblok/svelte 7.x.
- [Repository playground](https://github.com/storyblok/monoblok/tree/main/packages/svelte/playground)—Explore
  more examples in the SvelteKit playground.
- [Space Blueprint: Svelte](https://github.com/storyblok/blueprint-core-svelte)—Kickstart a new
  project with the core space blueprint for Svelte.
