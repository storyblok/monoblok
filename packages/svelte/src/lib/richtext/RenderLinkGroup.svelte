<script lang="ts">
  import { type StoryblokRichTextMark, type StoryblokRichTextNodeWithKey } from '@storyblok/richtext';

  import type { StoryblokSvelteRichTextRenderContext } from '../richtext-helpers';
  import ElementTag from './ElementTag.svelte';
  import RenderLinkInner from './RenderLinkInner.svelte';

  type Props = {
    nodes: StoryblokRichTextNodeWithKey[];
    linkMark: StoryblokRichTextMark & { type: 'link' };
    options: StoryblokSvelteRichTextRenderContext;
  };

  const { nodes, linkMark, options }: Props = $props();
  const CustomComponent = $derived(options.components ? options.components[linkMark.type] : undefined);
</script>

{#if CustomComponent}
  <CustomComponent {...linkMark} context={options}>
    <RenderLinkInner {nodes} {options} />
  </CustomComponent>
{:else}
  <ElementTag node={linkMark}>
    <RenderLinkInner {nodes} {options} />
  </ElementTag>
{/if}
