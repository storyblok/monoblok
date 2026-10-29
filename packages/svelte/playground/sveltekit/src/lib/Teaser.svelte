<script lang="ts">
  import { storyblokEditable } from '@storyblok/svelte';
  import type { StoryblokBlockComponentProps } from '@storyblok/svelte';

  const { block }: StoryblokBlockComponentProps<{ headline: string }> = $props();
</script>

<article use:storyblokEditable={block}>
  {block.headline}
</article>
