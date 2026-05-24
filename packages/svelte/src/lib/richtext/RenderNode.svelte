<script lang="ts">
  import { getStaticChildren, type SbRichTextNode } from '@storyblok/richtext';
  import type { SbSvelteRendererOptions } from '../richtext-helpers';
  import RenderTextNodeWithMarks from './RenderTextNodeWithMarks.svelte';
  import RenderChildren from './RenderChildren.svelte';
  import RenderImage from './RenderImage.svelte';
  import RenderTable from './RenderTable.svelte';
  import RenderStaticChildren from './RenderStaticChildren.svelte';
  import RenderElement from './RenderElement.svelte';
  import StoryblokComponent from '../StoryblokComponent.svelte';

  type Props = {
    node: SbRichTextNode;
    options: SbSvelteRendererOptions;
  };

  const { node, options }: Props = $props();
  const CustomComponent = $derived(
    options.components && node.type !== 'text' ? options.components[node.type] : undefined,
  );
</script>

{#if node.type === 'text'}
  <RenderTextNodeWithMarks {node} marks={node.marks} {options} />
{:else if CustomComponent}
  <CustomComponent {...node} {...options}>
    {#if node.content}
      <RenderChildren nodes={node.content} {options} />
    {/if}
  </CustomComponent>
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
  <RenderElement {node}>
    {#if node.content}
      <RenderChildren nodes={node.content} {options} />
    {/if}
  </RenderElement>
{/if}
