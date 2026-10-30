<script lang="ts">
  import { onStoryblokEditorEvent } from '@storyblok/svelte';
  import type { LivePreviewStory } from '@storyblok/svelte';
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  import { StoryblokBlock } from '../../storyblok';

  const { data }: { data: PageData } = $props();
  // Resets to the loaded story on navigation, and takes Visual Editor updates in between.
  let story = $derived<LivePreviewStory>(data.story);

  onMount(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    onStoryblokEditorEvent((newStory) => {
      if (!disposed) story = newStory;
    }, {
        preventClicks: true,
        resolveLinks: 'url',
    })
      .then((unsubscribe) => {
        if (disposed) unsubscribe();
        else cleanup = unsubscribe;
      })
      .catch((error) => console.error(error));
    return () => {
      disposed = true;
      cleanup?.();
    };
  });
</script>

<main>
  <h1>Welcome to StoryblokKit</h1>
  <StoryblokBlock block={story.content} />
</main>
