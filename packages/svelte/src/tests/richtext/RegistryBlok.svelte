<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '$lib/richtext-helpers';
  import { StoryblokBlock } from './registry';

  const { attrs }: StoryblokSvelteRichTextProps<'blok'> = $props();
  const blocks = $derived(Array.isArray(attrs?.body) ? attrs.body : []);
</script>

{#each blocks as block (block._uid)}
  <StoryblokBlock {block} />
{/each}
