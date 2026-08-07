<script lang="ts">
  import { buildSvelteAttrs } from '../richtext-helpers';
  import { isSelfClosing, resolveTag, type StoryblokRichTextMark, type StoryblokRichTextNode } from '@storyblok/richtext';
  import type { Snippet } from 'svelte';

  type Props = {
    node: StoryblokRichTextNode | StoryblokRichTextMark;
    children?: Snippet;
  };

  const { node, children }: Props = $props();
  const Tag = $derived(resolveTag(node));
  const processedAttrs = $derived(buildSvelteAttrs(node.type, 'attrs' in node ? (node.attrs ?? {}) : {}));
  const selfClosing = $derived(Tag && isSelfClosing(Tag));
</script>

{#if Tag}
  {#if selfClosing}
    <svelte:element this={Tag} {...processedAttrs} />
  {:else}
    <svelte:element this={Tag} {...processedAttrs}>
      {@render children?.()}
    </svelte:element>
  {/if}
{:else}
  {@render children?.()}
{/if}
