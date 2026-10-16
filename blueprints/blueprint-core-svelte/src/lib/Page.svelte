<script>
	import { StoryblokComponent, storyblokEditable } from '@storyblok/svelte';

	export let blok;
</script>

{#key blok}
	<main class="page" use:storyblokEditable={blok}>
		{#each blok.body as blok}
			<StoryblokComponent {blok} />
		{/each}
	</main>
{/key}
