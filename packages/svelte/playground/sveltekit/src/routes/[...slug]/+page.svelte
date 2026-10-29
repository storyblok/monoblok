<script lang="ts">
  import { onStoryblokEditorEvent } from '@storyblok/svelte';
  import type { LivePreviewStory } from '@storyblok/svelte';
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  import { StoryblokBlock } from '../../storyblok';

  let { data = $bindable() }: { data: PageData } = $props();
  let story = $state<LivePreviewStory>(data.story);
  let loaded = $state(false);
  onMount(() => {
    loaded = true;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    if (story) {
      onStoryblokEditorEvent((newStory) => {
        if (!disposed) story = newStory;
      }, {
        preventClicks: true,
        resolveLinks: 'url',
      }).then((unsubscribe) => {
        if (disposed) unsubscribe();
        else cleanup = unsubscribe;
      });
    }
    return () => {
      disposed = true;
      cleanup?.();
    };
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
