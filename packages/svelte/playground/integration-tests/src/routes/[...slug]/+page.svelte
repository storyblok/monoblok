<script lang="ts">
  import { onStoryblokEditorEvent } from '@storyblok/svelte';
  import type { LivePreviewStory } from '@storyblok/svelte';
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  import { StoryblokBlock } from '../../storyblok';

  let { data = $bindable() }: { data: PageData } = $props();
  let story = $state<LivePreviewStory>(data.story);
  onMount(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    if (story) {
      onStoryblokEditorEvent((newStory) => {
        if (!disposed) story = newStory;
      }, {
        preventClicks: true,
        resolveLinks: 'url',
        resolveRelations: ['featured-articles.posts'],
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
    <StoryblokBlock block={story.content} />
  {/key}
</main>
