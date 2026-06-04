<script lang="ts">
  import { getInnerMarks, type SbRichTextNode, type SbRichTextTextNode } from '@storyblok/richtext';

  import type { SbSvelteRichTextRenderContext } from '../richtext-helpers';
  import RenderTextNodeWithMarks from './RenderTextNodeWithMarks.svelte';

  type Props = {
    nodes: SbRichTextNode[];
    options: SbSvelteRichTextRenderContext;
  };

  const { nodes, options }: Props = $props();
</script>

{#each nodes as node (node._key)}
  {@const innerMarks = getInnerMarks(node)}

  <RenderTextNodeWithMarks node={node as SbRichTextTextNode} marks={innerMarks} {options} />
{/each}
