<script lang="ts">
  import { type SbRichTextMark, type SbRichTextTextNode } from '@storyblok/richtext';
  // eslint-disable-next-line import/no-self-import
  import RenderTextNodeWithMarks from './RenderTextNodeWithMarks.svelte';
  import type { SbSvelteRichTextRenderContext } from '../richtext-helpers';
  import RenderElement from './RenderElement.svelte';

  type Props = {
    node: SbRichTextTextNode;
    marks: SbRichTextMark[] | undefined;
    options: SbSvelteRichTextRenderContext;
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
  <MarkComponent {...mark}>
    <RenderTextNodeWithMarks {node} marks={rest} {options} />
  </MarkComponent>
{:else}
  <RenderElement node={mark}>
    <RenderTextNodeWithMarks {node} marks={rest} {options} />
  </RenderElement>
{/if}
