<script lang="ts">
  import { type SbRichTextNode, splitTableRows } from '@storyblok/richtext';
  import type { SbSvelteRichTextRenderContext } from '../richtext-helpers';
  import ElementTag from './ElementTag.svelte';
  import RenderNode from './RenderNode.svelte';

  type Props = {
    node: SbRichTextNode & { type: 'table' };
    options: SbSvelteRichTextRenderContext;
  };

  const { node, options }: Props = $props();
  const { headerRows, bodyRows } = $derived(splitTableRows(node.content));
</script>

<ElementTag {node}
  >{#if headerRows.length > 0}<thead>
      {#each headerRows as row (row._key)}
        <RenderNode node={row} {options} />
      {/each}
    </thead>{/if}{#if bodyRows.length > 0}<tbody>
      {#each bodyRows as row (row._key)}
        <RenderNode node={row} {options} />
      {/each}
    </tbody>{/if}</ElementTag
>
