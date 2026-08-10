<script lang="ts">
  import { groupLinkNodes, type StoryblokRichTextNodeWithKey } from '@storyblok/richtext';

  import type { StoryblokSvelteRichTextRenderContext } from '../richtext-helpers';
  import RenderLinkGroup from './RenderLinkGroup.svelte';
  import RenderNode from './RenderNode.svelte';

  type Props = {
    nodes: StoryblokRichTextNodeWithKey[];
    options: StoryblokSvelteRichTextRenderContext;
  };

  const { nodes, options }: Props = $props();
  const groups = $derived.by(() => groupLinkNodes(nodes));
</script>

{#each groups as group (group._key)}
  {#if group.linkMark}
    <RenderLinkGroup nodes={group.nodes.filter(node => node.type === 'text')} linkMark={group.linkMark} {options} />
  {:else}
    <RenderNode node={group.nodes[0]} {options} />
  {/if}
{/each}
