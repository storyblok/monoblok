<script lang="ts">
  import { StoryblokComponent, useStoryblokBridge } from '@storyblok/svelte';
  import type { PageData } from './$types';
  import { onMount } from 'svelte';

  let { data = $bindable() }: { data: PageData } = $props();
  let story = $state(data.story);
  let loaded = $state(false);
  onMount(() => {
    loaded = true;
    if (story) {
      useStoryblokBridge(data.story.id, (newStory) => (story = newStory), {
        preventClicks: true,
        resolveLinks: 'url',
      });
    }
  });
</script>

<main>
  {#key story}
    <h1>Welcome to StoryblokKit</h1>

    {#if loaded}
      <StoryblokComponent blok={story.content} />
    {/if}
  {/key}
</main>
