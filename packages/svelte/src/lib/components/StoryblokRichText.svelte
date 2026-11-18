<!--
  @component
  Renders a Storyblok rich text field, without a block registry: embedded
  bloks render only through `components.blok`, and warn otherwise unless
  `warnings={false}`. To render them through your registered components, use
  the `StoryblokRichText` returned by `defineStoryblokBlocks()` instead.

  @example
  ```svelte
  <StoryblokRichText document={block.text} components={{ heading: Heading }} />
  ```
-->
<script lang="ts">
  import { normalizeNodes } from '@storyblok/richtext';
  import RenderChildren from '../richtext/RenderChildren.svelte';
  import type { StoryblokRichTextComponentProps } from '../richtext-helpers';

  const {
    document,
    components = {},
    optimizeImage,
    data,
    warnings = true,
  }: StoryblokRichTextComponentProps = $props();
  const nodes = $derived.by(() => normalizeNodes(document, true));
</script>

<RenderChildren {nodes} options={{ components, optimizeImage, data, warnings }} />
