import { createApiClient } from '@storyblok/api-client';
import { defineStoryblokBlocks } from '@storyblok/astro';

import Feature from './storyblok/Feature.astro';
import Grid from './storyblok/Grid.astro';
import Page from './storyblok/Page.astro';
import Teaser from './storyblok/Teaser.astro';

const {
	STORYBLOK_DELIVERY_API_TOKEN,
	STORYBLOK_API_BASE_URL,
	STORYBLOK_REGION,
} = import.meta.env;

export const storyblokClient = createApiClient({
	accessToken: STORYBLOK_DELIVERY_API_TOKEN,
	/** Set the correct region for your space. Learn more: https://www.storyblok.com/docs/packages/storyblok-js#example-region-parameter */
	region: STORYBLOK_REGION || 'eu',
	/** The following code is only required when creating a Storyblok space directly via the Blueprints feature. */
	baseUrl: STORYBLOK_API_BASE_URL
		? new URL(STORYBLOK_API_BASE_URL).origin
		: undefined,
});

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
	components: {
		page: Page,
		grid: Grid,
		feature: Feature,
		teaser: Teaser,
	},
}));
