<script lang="ts">
  import { type SbRichTextMark, type SbRichTextTextNode } from '@storyblok/richtext';

  import type { SbSvelteRichTextRenderContext } from '../richtext-helpers';
  import ElementTag from './ElementTag.svelte';
  import RenderLinkInner from './RenderLinkInner.svelte';

  type Props = {
    nodes: SbRichTextTextNode[];
    linkMark: SbRichTextMark & { type: 'link' };
    options: SbSvelteRichTextRenderContext;
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
