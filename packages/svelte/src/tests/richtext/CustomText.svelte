<script lang="ts">
  import type { SbSvelteRichTextProps } from '$lib/richtext-helpers';

  const { context, text }: SbSvelteRichTextProps<'text'> = $props();
  const prefix = $derived((context?.data as { prefix: string } | undefined)?.prefix ?? '');
</script>

{prefix} {text.toUpperCase()}
