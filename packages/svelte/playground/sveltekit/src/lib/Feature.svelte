<script lang="ts">
  import { storyblokEditable } from '@storyblok/svelte';
  import type { StoryblokBlockComponentProps } from '@storyblok/svelte';

  const { block }: StoryblokBlockComponentProps<{ name: string }> = $props();
</script>

<article use:storyblokEditable={block}>
  {block.name}
</article>
