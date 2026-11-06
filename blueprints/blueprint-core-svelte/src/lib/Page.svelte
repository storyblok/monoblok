<script>
	import { StoryblokBlock } from '$lib/storyblok';

	let { block, editable } = $props();
</script>

<main class="page" {...editable}>
	{#each block.body as nestedBlock (nestedBlock._uid)}
		<StoryblokBlock block={nestedBlock} />
	{/each}
</main>
