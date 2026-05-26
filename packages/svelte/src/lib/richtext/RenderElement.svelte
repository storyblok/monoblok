<script lang="ts">
  import { buildSvelteAttrs } from '../richtext-helpers';
  import { isSelfClosing, resolveTag, type SbRichTextMark, type SbRichTextNode } from '@storyblok/richtext';
  import type { Snippet } from 'svelte';
  import DynamicElement from './DynamicElement.svelte';

  type Props = {
    node: SbRichTextNode | SbRichTextMark;
    children?: Snippet;
  };

  const { node, children }: Props = $props();
  const Tag = $derived(resolveTag(node));
  const processedAttrs = $derived(node.type !== 'text' ? buildSvelteAttrs(node.type, node?.attrs ?? {}) : {});
  const selfClosing = $derived(Tag && isSelfClosing(Tag));
</script>

{#if Tag}
  {#if selfClosing}
    <DynamicElement tag={Tag} attrs={processedAttrs} selfClosing={true} />
  {:else}
    <DynamicElement tag={Tag} attrs={processedAttrs}>
      {@render children?.()}
    </DynamicElement>
  {/if}
{:else}
  {@render children?.()}
{/if}
