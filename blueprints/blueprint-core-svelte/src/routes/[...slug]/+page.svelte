<script>
	import { onMount } from 'svelte';
	import { useStoryblokBridge, StoryblokComponent } from '@storyblok/svelte';
	export let data;

	onMount(() => {
		useStoryblokBridge(data.story.id, (newStory) => (data.story = newStory));
	});
	
	const currentYear = new Date().getFullYear();
</script>

<StoryblokComponent blok={data.story.content} />
<footer>All rights reserved © {currentYear}</footer>
