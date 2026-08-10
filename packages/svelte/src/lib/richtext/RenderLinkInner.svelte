<script lang="ts">
  import { getInnerMarks, type StoryblokRichTextNodeWithKey, type StoryblokRichTextTextNode } from '@storyblok/richtext';

  import type { StoryblokSvelteRichTextRenderContext } from '../richtext-helpers';
  import RenderTextNodeWithMarks from './RenderTextNodeWithMarks.svelte';

  type Props = {
    nodes: StoryblokRichTextNodeWithKey[];
    options: StoryblokSvelteRichTextRenderContext;
  };

  const { nodes, options }: Props = $props();
</script>

{#each nodes as node (node._key)}
  {@const innerMarks = getInnerMarks(node)}

  <RenderTextNodeWithMarks node={node as StoryblokRichTextTextNode} marks={innerMarks} {options} />
{/each}
