<script lang="ts">
  import { getStaticChildren, hasContent, resolveTag, type StoryblokRichTextNodeWithKey } from '@storyblok/richtext';
  import type { StoryblokSvelteRichTextRenderContext } from '../richtext-helpers';
  import RenderStaticStructure from './RenderStaticStructure.svelte';
  import RenderChildren from './RenderChildren.svelte';

  type Props = {
    node: Exclude<StoryblokRichTextNodeWithKey, { type: 'text' }>;
    options: StoryblokSvelteRichTextRenderContext;
  };

  const { node, options }: Props = $props();
  const staticChildren = $derived(getStaticChildren(node));
  const OuterTag = $derived(resolveTag(node));
  const attrs = $derived('attrs' in node ? (node.attrs ?? {}) : {});
</script>

{#if staticChildren && OuterTag}
  <svelte:element this={OuterTag}>
    <RenderStaticStructure type={node.type} specs={staticChildren} parentAttrs={attrs}>
      {#if hasContent(node)}
        <RenderChildren nodes={node.content} {options} />
      {/if}
    </RenderStaticStructure>
  </svelte:element>
{/if}
