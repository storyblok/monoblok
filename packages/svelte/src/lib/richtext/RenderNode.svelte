<script lang="ts">
  import { getStaticChildren, type SbRichTextNode } from '@storyblok/richtext';
  import type { SbSvelteRichTextRenderContext } from '../richtext-helpers';
  import RenderTextNodeWithMarks from './RenderTextNodeWithMarks.svelte';
  import RenderChildren from './RenderChildren.svelte';
  import RenderImage from './RenderImage.svelte';
  import RenderTable from './RenderTable.svelte';
  import RenderStaticChildren from './RenderStaticChildren.svelte';
  import ElementTag from './ElementTag.svelte';
  import StoryblokComponent from '../StoryblokComponent.svelte';

  type Props = {
    node: SbRichTextNode;
    options: SbSvelteRichTextRenderContext;
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
</script>

{#if CustomComponent}
  <CustomComponent {...node} context={contextForCustom}>
    {#if node.type !== 'text' && node.content}
      <RenderChildren nodes={node.content} {options} />
    {/if}
  </CustomComponent>
{:else if node.type === 'text'}
  <RenderTextNodeWithMarks {node} marks={node.marks} {options} />
{:else if node.type === 'image'}
  <RenderImage {node} {options} />
{:else if node.type === 'blok'}
  {#if Array.isArray(node.attrs?.body)}
    {#each node.attrs.body as blok (blok._uid)}
      <StoryblokComponent {blok} />
    {/each}
  {/if}
{:else if node.type === 'table'}
  <RenderTable {node} {options} />
{:else if getStaticChildren(node)}
  <RenderStaticChildren {node} {options} />
{:else}
  <ElementTag {node}>
    {#if node.content}
      <RenderChildren nodes={node.content} {options} />
    {/if}
  </ElementTag>
{/if}
