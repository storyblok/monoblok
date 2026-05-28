<script lang="ts">
  import { type SbRichTextMark, type SbRichTextNode } from '@storyblok/richtext';

  import type { SbSvelteRichTextRenderContext } from '../richtext-helpers';
  import RenderElement from './RenderElement.svelte';
  import LinkInner from './LinkInner.svelte';

  type Props = {
    nodes: SbRichTextNode[];
    linkMark: SbRichTextMark;
    options: SbSvelteRichTextRenderContext;
  };

  const { nodes, linkMark, options }: Props = $props();
  const CustomComponent = $derived(options.components ? options.components[linkMark.type] : undefined);
</script>

{#if CustomComponent}
  <CustomComponent {...linkMark}>
    <LinkInner {nodes} {options} />
  </CustomComponent>
{:else}
  <RenderElement node={linkMark}>
    <LinkInner {nodes} {options} />
  </RenderElement>
{/if}
