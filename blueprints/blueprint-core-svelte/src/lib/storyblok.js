import { createApiClient } from '@storyblok/api-client';
import { defineStoryblokBlocks } from '@storyblok/svelte';
import Feature from './Feature.svelte';
import Grid from './Grid.svelte';
import Page from './Page.svelte';
import Teaser from './Teaser.svelte';

export const apiClient = createApiClient({
	accessToken: import.meta.env.STORYBLOK_DELIVERY_API_TOKEN ?? '',
	/** Set the correct region for your space. Learn more: https://www.storyblok.com/docs/packages/storyblok-js#example-region-parameter */
	region: import.meta.env.STORYBLOK_REGION || 'eu',
	/** The following code is only required when creating a Storyblok space directly via the Blueprints feature. */
	baseUrl: import.meta.env.STORYBLOK_API_BASE_URL
		? new URL(import.meta.env.STORYBLOK_API_BASE_URL).origin
		: undefined,
});

/** Register every block component here, keyed by its technical name in Storyblok. */
export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
	components: {
		teaser: Teaser,
		feature: Feature,
		grid: Grid,
		page: Page,
	},
}));
