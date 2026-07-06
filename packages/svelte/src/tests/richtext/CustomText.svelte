<script lang="ts">
  import type { SbSvelteRichTextProps } from '$lib/richtext-helpers';

  const props: SbSvelteRichTextProps<'text'> = $props();
  const data = props.context?.data as { prefix: string } | undefined;
  const prefix = data?.prefix ?? '';
</script>

{prefix} {props.text.toUpperCase()}
