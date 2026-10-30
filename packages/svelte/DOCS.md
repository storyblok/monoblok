# Migrate to the new Svelte SDK API

The new Svelte SDK API separates content fetching, block registration, and Visual Editor
integration. Use `@storyblok/api-client` to fetch content and `defineStoryblokBlocks` to register
Svelte block components.

## Replace `storyblokInit`

Before:

```svelte
<script lang="ts">
  import { apiPlugin, storyblokInit } from '@storyblok/svelte';

  storyblokInit({
    accessToken: 'your-preview-token',
    use: [apiPlugin],
  });
</script>
```

After:

```ts
import { createApiClient } from "@storyblok/api-client";
import { defineStoryblokBlocks } from "@storyblok/svelte";
import Page from "$lib/blocks/Page.svelte";

export const client = createApiClient({ accessToken: "your-preview-token" });

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
  components: { page: Page },
}));
```

Fetch a story with the API client and render its content with the registered `StoryblokBlock`
component:

```svelte
<StoryblokBlock block={story.content} />
```

## Rename the `blok` prop to `block`

Registered components receive the block content as `block` instead of `blok`. Update every block
component and its prop type:

Before:

```svelte
<script lang="ts">
  import type { StoryblokComponentProps } from '@storyblok/svelte';

  const { blok }: StoryblokComponentProps<{ headline: string }> = $props();
</script>

<h2>{blok.headline}</h2>
```

After:

```svelte
<script lang="ts">
  import type { StoryblokBlockComponentProps } from '@storyblok/svelte';

  const { block }: StoryblokBlockComponentProps<{ headline: string }> = $props();
</script>

<h2>{block.headline}</h2>
```

A component that still reads `blok` receives `undefined` and throws when it accesses a field.

## Replace `use:storyblokEditable`

Before:

```svelte
<section use:storyblokEditable={block}>{block.headline}</section>
```

After:

```svelte
<script lang="ts">
  import type { StoryblokBlockComponentProps } from '@storyblok/svelte';

  const { block, editable }: StoryblokBlockComponentProps = $props();
</script>

<section {...editable}>{block.headline}</section>
```

`StoryblokBlock` calculates `editable` and passes it to every registered block. Spread it onto the
block’s root element to enable Visual Editor editing.

`storyblokEditable` is no longer a Svelte action. It now returns the editable attributes for a
block, so `use:storyblokEditable={block}` passes the DOM node instead of the block and adds no
attributes. To compute the attributes outside a registered component, spread the function’s result:

```svelte
<section {...storyblokEditable(block)}>{block.headline}</section>
```

## Replace `useStoryblokBridge`

Subscribe to Visual Editor changes with `onStoryblokEditorEvent`. The function loads the Storyblok
Bridge, returns a promise that resolves to an unsubscribe function, and does nothing outside the
Visual Editor.

Before:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { useStoryblokBridge } from '@storyblok/svelte';

  let { data } = $props();
  let story = $state(data.story);

  onMount(() => {
    useStoryblokBridge(story.id, (newStory) => (story = newStory));
  });
</script>
```

After:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { onStoryblokEditorEvent } from '@storyblok/svelte';
  import type { LivePreviewStory } from '@storyblok/svelte';
  import { StoryblokBlock } from '$lib/storyblok';

  let { data } = $props();
  // Resets to the loaded story on navigation, and takes Visual Editor updates in between.
  let story = $derived<LivePreviewStory>(data.story);

  onMount(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    onStoryblokEditorEvent(
      (newStory) => {
        if (!disposed) story = newStory;
      },
      { resolveRelations: ['featured-articles.posts'] },
    )
      .then((cleanup) => {
        if (disposed) cleanup();
        else unsubscribe = cleanup;
      })
      .catch((error) => console.error(error));

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  });
</script>

<StoryblokBlock block={story.content} />
```

Pass the same `resolveRelations` and `resolveLinks` values you use to fetch the story, so updated
content keeps its resolved relations. Unlike `useStoryblokBridge`, the callback doesn’t filter by
story ID: it receives every story the Visual Editor sends.

## Render embedded rich text blocks

Embedded blocks in rich text require a `components.blok` renderer. Create a renderer that passes
each embedded block to the same block registry:

```svelte
<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '@storyblok/svelte';
  import { StoryblokBlock } from '$lib/storyblok';

  const { attrs }: StoryblokSvelteRichTextProps<'blok'> = $props();
</script>

{#each Array.isArray(attrs?.body) ? attrs.body : [] as block (block._uid)}
  <StoryblokBlock {block} />
{/each}
```

Pass the renderer to `StoryblokRichText`:

```svelte
<StoryblokRichText document={story.content.richText} components={{ blok: Blok }} />
```

## Removed exports

The following Svelte exports are no longer available:

- `storyblokInit`, `apiPlugin`, `getStoryblokApi`, and `useStoryblokApi`: fetch content with
  `createApiClient` from `@storyblok/api-client`.
- `StoryblokClient`, `ISbStoryData`, `ISbStory`, `ISbStoryParams`, `ISbStories`, `ISbStoriesParams`,
  `ISbResult`, `ISbManagmentApiResult`, `ISbCache`, `ISbConfig`, and `ISbAlternateObject`: import
  `Story` and the request types from `@storyblok/api-client`.
- `SbSDKOptions` and `SbSvelteSDKOptions`: configure `createApiClient` with its typed options.
- `StoryblokComponent` and `getComponent`: use the registry-bound `StoryblokBlock` returned by
  `defineStoryblokBlocks`.
- `SbSvelteComponentsMap`: use `StoryblokComponentMap`.
- `StoryblokComponentProps`: use `StoryblokBlockComponentProps`.
- `SbBlokData`, `SbBlokKeyDataTypes`, and `StoryblokComponentType`: use `StoryblokBlockData`.
- `StoryblokBridgeV2`, `StoryblokBridgeConfigV2`, and `useStoryblokBridge`: use
  `onStoryblokEditorEvent` and `loadStoryblokBridge`, and the `BridgeParams` type.
- `SbSvelteRichTextComponentMap`, `SbSvelteRichTextProps`, and `SbSvelteRichTextRenderContext`: use
  the `StoryblokSvelteRichText*` types.
- `SbRichTextDoc`, `SbRichTextElement`, `SbRichTextImageOptions`, `SbRichTextInput`,
  `SbRichTextMark`, `SbRichTextNode`, `SbRichTextProps`, `SbRichTextRenderContext`,
  `SbRichTextTextNode`, and `RenderSpec`: use the `StoryblokRichText*` types.
- `renderRichText`, `buildStoryblokImage`, `splitTableRows`, `attrsToHtmlString`, `getInnerMarks`,
  `getStaticChildren`, `groupLinkNodes`, `hasContent`, `isSelfClosing`, `normalizeNodes`,
  `processAttrs`, `resolveTag`, and `styleToString`: import these helpers from `@storyblok/richtext`
  when you need them in custom renderers.

The `storyblok__outline` class is no longer added automatically. Use the editable attributes
returned through the `editable` prop and provide any visual editing styles in your application.

## Draft documentation status

This migration guide is a draft for the documentation platform. Move it to the Svelte SDK
documentation before merging and remove this file from the package.
