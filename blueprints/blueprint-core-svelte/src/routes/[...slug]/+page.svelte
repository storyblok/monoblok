<script>
	import { onStoryblokEditorEvent } from '@storyblok/svelte';
	import { StoryblokBlock } from '$lib/storyblok';

	let { data } = $props();
	// Resets to the loaded story on navigation, and takes Visual Editor updates in between.
	let story = $derived(data.story);

	$effect(() => onStoryblokEditorEvent((newStory) => (story = newStory)));

	const currentYear = new Date().getFullYear();
</script>

<StoryblokBlock block={story.content} />
<footer>All rights reserved © {currentYear}</footer>
