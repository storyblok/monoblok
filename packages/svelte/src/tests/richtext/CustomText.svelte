<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '$lib/richtext-helpers';

  const { context, text }: StoryblokSvelteRichTextProps<'text', { prefix: string }> =
    $props();
  const prefix = $derived(context.data.prefix);
</script>

{prefix} {text.toUpperCase()}
