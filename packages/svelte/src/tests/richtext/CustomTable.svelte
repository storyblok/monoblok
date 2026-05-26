<script lang="ts">
  import { splitTableRows } from '@storyblok/richtext';

  import type { SbSvelteRichTextProps } from '$lib';
  import StoryblokRichText from '$lib/StoryblokRichText.svelte';

  const { content, components }: SbSvelteRichTextProps<'table'> = $props();
  const { headerRows, bodyRows } = $derived(splitTableRows(content));
</script>

<table class="custom-table">

  {#if headerRows.length > 0}
    <thead>
      {#each headerRows as row (row._key)}<StoryblokRichText document={row} {components} />{/each}
    </thead>
  {/if}{#if bodyRows.length > 0}
    <tbody>
      {#each bodyRows as row (row._key)}<StoryblokRichText document={row} {components} />{/each}
    </tbody>
  {/if}
</table>
