<script lang="ts">
  import type { StoryblokSvelteRichTextProps } from '@storyblok/svelte';
  type Props = StoryblokSvelteRichTextProps<'heading'>;
  const props: Props = $props();
</script>

<p>
  {@render props.children?.()}
</p>
