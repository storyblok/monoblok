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

## Render embedded rich text bloks

Embedded bloks in rich text require a `components.blok` renderer. Create a renderer that passes each
embedded block to the same block registry:

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

- `ISbStoryData`, `ISbStory`, `ISbStoryParams`, `ISbStories`, and `ISbStoriesParams`: import `Story`
  and the request types from `@storyblok/api-client`.
- `SbBlokData`: use `StoryblokBlockData` from `@storyblok/svelte` for block component data.
- `StoryblokComponent`: use the registry-bound `StoryblokBlock` returned by `defineStoryblokBlocks`.
- `StoryblokClient`: create a client with `createApiClient` from `@storyblok/api-client`.
- `StoryblokBridgeV2`, `StoryblokBridgeConfigV2`, and `useStoryblokBridge`: use
  `onStoryblokEditorEvent` and `loadStoryblokBridge` from `@storyblok/svelte`.
- `apiPlugin`: no longer needed; fetch content with the API client.
- `SbSDKOptions`: configure `createApiClient` with its typed options.
- `renderRichText`, `buildStoryblokImage`, and `splitTableRows`: import these helpers from
  `@storyblok/richtext` when you need them in custom renderers.

The `storyblok__outline` class is no longer added automatically. Use the editable attributes
returned through the `editable` prop and provide any visual editing styles in your application.

## Draft documentation status

This migration guide is a draft for the documentation platform. Move it to the Svelte SDK
documentation before merging and remove this file from the package.
