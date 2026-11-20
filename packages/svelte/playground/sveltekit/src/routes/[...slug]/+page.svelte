<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onStoryblokEditorEvent } from '@storyblok/svelte';
  import type { LivePreviewStory } from '@storyblok/svelte';
  import type { PageData } from './$types';
  import { StoryblokBlock } from '../../storyblok';

  const { data }: { data: PageData } = $props();
  // Resets to the loaded story on navigation, and takes Visual Editor updates in between.
  let story = $derived<LivePreviewStory>(data.story);

  $effect(() =>
    onStoryblokEditorEvent(
      (newStory) => {
        // The Visual Editor can send another story's updates, for example after a
        // client-side navigation inside the preview. Only take this page's story.
        if (newStory.id === data.story.id) story = newStory;
      },
      {
        preventClicks: true,
        resolveLinks: 'url',
        // Refetch the story on save and publish instead of reloading the page.
        onChange: () => invalidateAll(),
      },
    ),
  );
</script>

<main>
  <h1>Welcome to StoryblokKit</h1>
  <StoryblokBlock block={story.content} />
</main>
