import { createApiClient } from '@storyblok/api-client';
import { defineStoryblokBlocks } from '@storyblok/react';

import Page from './storyblok/Page';
import Teaser from './storyblok/Teaser';
import Feature from './storyblok/Feature';
import Grid from './storyblok/Grid';

export const apiClient = createApiClient({
	accessToken: import.meta.env.STORYBLOK_DELIVERY_API_TOKEN,
	/** Set the correct region for your space. Learn more: https://www.storyblok.com/docs/packages/storyblok-react */
	region: import.meta.env.STORYBLOK_REGION || 'eu',
	/** The following code is only required when creating a Storyblok space directly via the Blueprints feature. */
	baseUrl: import.meta.env.STORYBLOK_API_BASE_URL
		? new URL(import.meta.env.STORYBLOK_API_BASE_URL).origin
		: undefined,
});

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
	components: {
		page: Page,
		teaser: Teaser,
		feature: Feature,
		grid: Grid,
	},
}));
