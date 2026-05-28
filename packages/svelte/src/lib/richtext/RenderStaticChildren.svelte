<script lang="ts">
  import { getStaticChildren, resolveTag, type SbRichTextNode } from '@storyblok/richtext';
  import type { SbSvelteRichTextRenderContext } from '../richtext-helpers';
  import RenderStaticStructure from './RenderStaticStructure.svelte';
  import RenderChildren from './RenderChildren.svelte';
  import DynamicElement from './DynamicElement.svelte';

  type Props = {
    node: SbRichTextNode;
    options: SbSvelteRichTextRenderContext;
  };

  const { node, options }: Props = $props();
  const staticChildren = $derived(getStaticChildren(node));
  const OuterTag = $derived(resolveTag(node));
</script>

{#if staticChildren && node.type !== 'text' && OuterTag}
  <DynamicElement tag={OuterTag}>
    <RenderStaticStructure type={node.type} specs={staticChildren} parentAttrs={node.attrs}>
      {#if node.content}
        <RenderChildren nodes={node.content} {options} />
      {/if}
    </RenderStaticStructure>
  </DynamicElement>
{/if}
