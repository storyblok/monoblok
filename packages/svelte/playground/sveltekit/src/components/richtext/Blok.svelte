<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '@storyblok/svelte';
  import { StoryblokBlock } from '../../storyblok';

  const { attrs }: StoryblokSvelteRichTextProps<'blok'> = $props();
</script>

{#each Array.isArray(attrs?.body) ? attrs.body : [] as block (block._uid)}
  <StoryblokBlock {block} />
{/each}
