<script module lang="ts">
  import type { StoryblokSvelteRichTextProps } from '../richtext-helpers';
  import { REGISTRY_PROP, type StoryblokBlockRegistry } from './StoryblokBlock.svelte';

  export type StoryblokRichTextBlokProps = StoryblokSvelteRichTextProps<'blok'> & {
    [REGISTRY_PROP]: StoryblokBlockRegistry;
  };
</script>

<script lang="ts">
  import type { StoryblokBlockData } from '../types';
  import StoryblokBlock from './StoryblokBlock.svelte';

  // The default `blok` renderer of the `StoryblokRichText` returned by
  // `defineStoryblokBlocks()`: renders each embedded block through the same
  // registry as `StoryblokBlock`.
  const { attrs, context, __storyblokRegistry: registry }: StoryblokRichTextBlokProps = $props();

  const blocks = $derived(
    (Array.isArray(attrs?.body) ? attrs.body : []).filter(
      (block: unknown): block is StoryblokBlockData =>
        typeof block === 'object' && block !== null && typeof Reflect.get(block, 'component') === 'string',
    ),
  );

  // A plain-object `data` passed to `StoryblokRichText` is forwarded to every
  // embedded block as extra props, like the extra props `StoryblokBlock`
  // passes to a block it renders directly.
  const extraProps = $derived(
    typeof context?.data === 'object' && context.data !== null && !Array.isArray(context.data)
      ? context.data
      : {},
  );

  // `warnings={false}` on `StoryblokRichText` also silences the registry's
  // warnings for the embedded blocks it renders.
  const blockRegistry = $derived<StoryblokBlockRegistry>(
    context?.warnings === false ? { ...registry, warn: () => {} } : registry,
  );
</script>

{#each blocks as block, index (block._uid ?? index)}
  <!-- `extraProps` first, so a `data.block` can't replace the block. -->
  <StoryblokBlock {...extraProps} {block} __storyblokRegistry={blockRegistry} />
{/each}
