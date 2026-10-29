<script lang="ts">
  import { onStoryblokEditorEvent } from '@storyblok/svelte';
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  import { StoryblokBlock } from '$lib/storyblok';

  let { data = $bindable() }: { data: PageData } = $props();
  let story = $state(data.story);
  let loaded = $state(false);
  onMount(() => {
    loaded = true;
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

    {#if loaded}
      <StoryblokBlock block={story.content} />
    {/if}
  {/key}
</main>
