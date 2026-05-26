<script lang="ts">
  import type { SbSvelteRichTextProps } from '$lib/richtext-helpers';

  const props: SbSvelteRichTextProps<'bold'> = $props();
</script>

<b data-type="custom-bold">
  {@render props.children?.()}
</b>
