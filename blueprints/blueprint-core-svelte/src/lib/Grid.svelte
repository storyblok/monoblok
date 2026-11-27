<script>
	import { StoryblokBlock } from '#lib/storyblok.js';

	let { block, editable } = $props();
</script>

<div class="grid" {...editable}>
	{#each block.columns as column (column._uid)}
		<StoryblokBlock block={column} />
	{/each}
</div>
