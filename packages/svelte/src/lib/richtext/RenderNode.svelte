<script lang="ts">
  import { getStaticChildren, hasContent, type StoryblokRichTextNodeWithKey } from '@storyblok/richtext';
  import type { StoryblokSvelteRichTextRenderContext } from '../richtext-helpers';
  import RenderTextNodeWithMarks from './RenderTextNodeWithMarks.svelte';
  import RenderChildren from './RenderChildren.svelte';
  import RenderImage from './RenderImage.svelte';
  import RenderTable from './RenderTable.svelte';
  import RenderStaticChildren from './RenderStaticChildren.svelte';
  import ElementTag from './ElementTag.svelte';

  type Props = {
    node: StoryblokRichTextNodeWithKey;
    options: StoryblokSvelteRichTextRenderContext;
  };

  const { node, options }: Props = $props();
  const CustomComponent = $derived(
    options.components ? options.components[node.type] : undefined,
  );

  // When passing context to a custom component, exclude that component type
  // to prevent infinite loops if the custom component uses StoryblokRichText internally
  const contextForCustom = $derived(
    CustomComponent
      ? { ...options, components: { ...options.components, [node.type]: undefined } }
      : options,
  );

  $effect(() => {
    if (node.type === 'blok' && !CustomComponent) {
      console.warn('[storyblok] "blok" nodes require a custom renderer passed through `components.blok`.');
    }
  });
</script>

{#if CustomComponent}
  <CustomComponent {...node} context={contextForCustom}>
    {#if hasContent(node)}
      <RenderChildren nodes={node.content} {options} />
    {/if}
  </CustomComponent>
{:else if node.type === 'text'}
  <RenderTextNodeWithMarks {node} marks={node.marks} {options} />
{:else if node.type === 'image'}
  <RenderImage {node} {options} />
{:else if node.type === 'table'}
  <RenderTable {node} {options} />
{:else if node.type === 'emoji'}
  <ElementTag {node}>{node.attrs.emoji}</ElementTag>
{:else if node.type !== 'blok' && getStaticChildren(node)}
  <RenderStaticChildren {node} {options} />
{:else if node.type !== 'blok'}
  <ElementTag {node}>
    {#if hasContent(node)}
      <RenderChildren nodes={node.content} {options} />
    {/if}
  </ElementTag>
{/if}
