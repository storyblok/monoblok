<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '@storyblok/svelte';
  type Props = StoryblokSvelteRichTextProps<'bold'>;
  const props: Props = $props();
</script>

<b>
  {@render props.children?.()}
</b>
