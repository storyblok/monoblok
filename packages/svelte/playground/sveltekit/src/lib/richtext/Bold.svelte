<script lang="ts">
  import type { SbSvelteRichTextProps } from '@storyblok/svelte';
  type Props = SbSvelteRichTextProps<'bold'>;
  const props: Props = $props();
</script>

<b>
  {@render props.children?.()}
</b>
