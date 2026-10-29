<script lang="ts">
  import { onStoryblokEditorEvent } from '@storyblok/svelte';
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  import { StoryblokBlock } from '../../storyblok';

  let { data = $bindable() }: { data: PageData } = $props();
  let story = $state(data.story);
  onMount(() => {
    let cleanup: (() => void) | undefined;
    if (story) {
      onStoryblokEditorEvent((newStory) => (story = newStory as typeof story), {
        preventClicks: true,
        resolveLinks: 'url',
      }).then((unsubscribe) => (cleanup = unsubscribe));
    }
    return () => cleanup?.();
  });
</script>

<main>
  {#key story}
    <h1>Welcome to StoryblokKit</h1>
    <StoryblokBlock block={story.content} />
  {/key}
</main>
