<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '$lib/richtext-helpers';

  const { attrs }: StoryblokSvelteRichTextProps<'blok'> = $props();
</script>

{#each Array.isArray(attrs?.body) ? attrs.body : [] as block}
  <span data-testid="embedded-block">{String(block.title ?? '')}</span>
{/each}
