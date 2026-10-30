<script lang="ts">
  import type { StoryblokBlockComponentProps } from '@storyblok/svelte';

  const { block, editable }: StoryblokBlockComponentProps<{ headline: string }> = $props();
</script>

<article {...editable}>
  {block.headline}
</article>
