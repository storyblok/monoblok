<script lang="ts">
  import { getStaticChildren, resolveTag, type SbRichTextNode } from '@storyblok/richtext';
  import type { SbSvelteRichTextRenderContext } from '../richtext-helpers';
  import RenderStaticStructure from './RenderStaticStructure.svelte';
  import RenderChildren from './RenderChildren.svelte';

  type Props = {
    node: Exclude<SbRichTextNode, { type: 'text' }>;
    options: SbSvelteRichTextRenderContext;
  };

  const { node, options }: Props = $props();
  const staticChildren = $derived(getStaticChildren(node));
  const OuterTag = $derived(resolveTag(node));
</script>

{#if staticChildren && OuterTag}
  <svelte:element this={OuterTag}>
    <RenderStaticStructure type={node.type} specs={staticChildren} parentAttrs={node.attrs}>
      {#if node.content}
        <RenderChildren nodes={node.content} {options} />
      {/if}
    </RenderStaticStructure>
  </svelte:element>
{/if}
