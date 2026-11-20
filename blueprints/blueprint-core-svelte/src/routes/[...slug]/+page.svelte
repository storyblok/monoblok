<script>
	import { onStoryblokEditorEvent } from '@storyblok/svelte';
	import { StoryblokBlock } from '$lib/storyblok';

	let { data } = $props();
	// Resets to the loaded story on navigation, and takes Visual Editor updates in between.
	let story = $derived(data.story);

	$effect(() =>
		onStoryblokEditorEvent((newStory) => {
			// The Visual Editor can send another story's updates, for example after a
			// client-side navigation inside the preview. Only take this page's story.
			if (newStory.id === data.story.id) story = newStory;
		}),
	);

	const currentYear = new Date().getFullYear();
</script>

<StoryblokBlock block={story.content} />
<footer>All rights reserved © {currentYear}</footer>
