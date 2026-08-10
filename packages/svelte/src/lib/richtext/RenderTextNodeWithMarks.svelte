<script lang="ts">
  import { type StoryblokRichTextMark, type StoryblokRichTextTextNode } from '@storyblok/richtext';
  // eslint-disable-next-line import/no-self-import
  import RenderTextNodeWithMarks from './RenderTextNodeWithMarks.svelte';
  import type { StoryblokSvelteRichTextRenderContext } from '../richtext-helpers';
  import ElementTag from './ElementTag.svelte';

  type Props = {
    node: StoryblokRichTextTextNode;
    marks?: StoryblokRichTextMark[];
    options: StoryblokSvelteRichTextRenderContext;
  };

  const { node, marks = [], options }: Props = $props();
  const reversedMarks = $derived([...marks].reverse());

  const mark = $derived(reversedMarks[0]);

  const rest = $derived(reversedMarks.slice(1));

  const MarkComponent = $derived(mark && options.components ? options.components[mark.type] : undefined);
</script>

{#if reversedMarks.length === 0}
  {node.text}
{:else if MarkComponent}
  <MarkComponent {...mark} context={options}>
    <RenderTextNodeWithMarks {node} marks={rest} {options} />
  </MarkComponent>
{:else}
  <ElementTag node={mark}>
    <RenderTextNodeWithMarks {node} marks={rest} {options} />
  </ElementTag>
{/if}
