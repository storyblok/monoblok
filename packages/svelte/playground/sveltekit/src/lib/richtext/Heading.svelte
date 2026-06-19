<script lang="ts">
  import type { SbSvelteRichTextProps } from '@storyblok/svelte';
  type Props = SbSvelteRichTextProps<'heading'>;
  const props: Props = $props();
</script>

<p>
  {@render props.children?.()}
</p>
