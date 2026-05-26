<script lang="ts">
  import { type SbRichTextNode, splitTableRows } from '@storyblok/richtext';
  import type { SbSvelteRendererOptions } from '../richtext-helpers';
  import RenderElement from './RenderElement.svelte';
  import RenderNode from './RenderNode.svelte';

  type Props = {
    node: SbRichTextNode;
    options: SbSvelteRendererOptions;
  };

  const { node, options }: Props = $props();
  const { headerRows, bodyRows } = $derived(splitTableRows(node.content));
</script>

<RenderElement {node}>{#if headerRows.length > 0}<thead>
    {#each headerRows as row (row._key)}
      <RenderNode node={row} {options} />
    {/each}
  </thead>{/if}{#if bodyRows.length > 0}<tbody>
    {#each bodyRows as row (row._key)}
      <RenderNode node={row} {options} />
    {/each}
  </tbody>{/if}</RenderElement>
