<script lang="ts">
  import type { StoryblokBlockComponentProps } from '@storyblok/svelte';

  const { block, editable }: StoryblokBlockComponentProps<{ name: string }> = $props();
</script>

<article {...editable}>
  {block.name}
</article>
