<script lang="ts">
  import type { PMMark, SbRichTextRenderers } from '../index';
  import MarkWrapper from './MarkWrapper.svelte';
  // eslint-disable-next-line import/no-self-import
  import MarkRenderer from './MarkRenderer.svelte';

  type Props = {
    text: string;
    marks?: PMMark[];
    components?: SbRichTextRenderers;
  };

  const { text, marks = [], components = {} }: Props = $props();
</script>

{#if marks.length === 0}
  {text}
{:else}
  {@const [mark, ...rest] = marks}
  {@const MarkComponent = components[mark.type]}

  {#if MarkComponent}
    <MarkComponent {mark}>
      <MarkRenderer {text} marks={rest} {components} />
    </MarkComponent>
  {:else}
    <MarkWrapper {mark}>
      <MarkRenderer {text} marks={rest} {components} />
    </MarkWrapper>
  {/if}
{/if}
