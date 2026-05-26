<script lang="ts">
  import { groupLinkNodes, type SbRichTextNode } from '@storyblok/richtext';

  import type { SbSvelteRendererOptions } from '../richtext-helpers';
  import RenderLinkGroup from './RenderLinkGroup.svelte';
  import RenderNode from './RenderNode.svelte';

  type Props = {
    nodes: SbRichTextNode[];
    options: SbSvelteRendererOptions;
  };

  const { nodes, options }: Props = $props();
  const groups = $derived.by(() => groupLinkNodes(nodes));
</script>

{#each groups as group (group._key)}
  {#if group.linkMark}
    <RenderLinkGroup nodes={group.nodes} linkMark={group.linkMark} {options} />
  {:else}
    <RenderNode node={group.nodes[0]} {options} />
  {/if}
{/each}
