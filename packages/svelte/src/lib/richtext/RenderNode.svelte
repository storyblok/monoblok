<script lang="ts">
  import { getStaticChildren, hasContent, type StoryblokRichTextNodeWithKey } from '@storyblok/richtext';
  import type { Component } from 'svelte';
  import type { StoryblokSvelteRichTextRenderContext } from '../richtext-helpers';
  import RenderTextNodeWithMarks from './RenderTextNodeWithMarks.svelte';
  import RenderChildren from './RenderChildren.svelte';
  import RenderImage from './RenderImage.svelte';
  import RenderTable from './RenderTable.svelte';
  import RenderStaticChildren from './RenderStaticChildren.svelte';
  import ElementTag from './ElementTag.svelte';
  import WarnMissingBlok from './WarnMissingBlok.svelte';

  type Props = {
    node: StoryblokRichTextNodeWithKey;
    options: StoryblokSvelteRichTextRenderContext;
  };

  const { node, options }: Props = $props();
  // `any`: the node or mark type is only known at runtime, so the props of
  // the component looked up for it can't be checked here. The map was checked
  // where it was passed to `StoryblokRichText`.
  const CustomComponent: Component<any> | undefined = $derived(
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
{:else if node.type === 'blok'}
  <WarnMissingBlok warnings={options.warnings ?? true} />
{:else if getStaticChildren(node)}
  <RenderStaticChildren {node} {options} />
{:else}
  <ElementTag {node}>
    {#if hasContent(node)}
      <RenderChildren nodes={node.content} {options} />
    {/if}
  </ElementTag>
{/if}
