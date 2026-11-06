<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '$lib/richtext-helpers';

  const { context, text }: StoryblokSvelteRichTextProps<'text'> = $props();
  const prefix = $derived((context?.data as { prefix: string } | undefined)?.prefix ?? '');
</script>

{prefix} {text.toUpperCase()}
