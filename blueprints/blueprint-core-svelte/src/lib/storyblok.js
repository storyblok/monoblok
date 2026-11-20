import { defineStoryblokBlocks } from '@storyblok/svelte';
import Feature from './Feature.svelte';
import Grid from './Grid.svelte';
import Page from './Page.svelte';
import Teaser from './Teaser.svelte';

/** Register every block component here, keyed by its technical name in Storyblok. */
export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
	components: {
		teaser: Teaser,
		feature: Feature,
		grid: Grid,
		page: Page,
	},
}));
