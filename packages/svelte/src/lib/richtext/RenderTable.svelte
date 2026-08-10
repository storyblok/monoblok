<script lang="ts">
  import { splitTableRows, type StoryblokRichTextNodeWithKey } from '@storyblok/richtext';
  import type { StoryblokSvelteRichTextRenderContext } from '../richtext-helpers';
  import ElementTag from './ElementTag.svelte';
  import RenderNode from './RenderNode.svelte';

  type Props = {
    node: StoryblokRichTextNodeWithKey & { type: 'table' };
    options: StoryblokSvelteRichTextRenderContext;
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
