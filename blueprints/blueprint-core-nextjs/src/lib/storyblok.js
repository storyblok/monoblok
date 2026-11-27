import { createApiClient } from '@storyblok/api-client';
import { defineStoryblokBlocks } from '@storyblok/react';

import Page from '@/components/Page';
import Feature from '@/components/Feature';
import Grid from '@/components/Grid';
import Teaser from '@/components/Teaser';

export const apiClient = createApiClient({
	/** Falls back to an empty token so `next build` works without one; requests then fail with a 401. */
	accessToken: process.env.STORYBLOK_DELIVERY_API_TOKEN ?? '',
	/** Set the correct region for your space. Learn more: https://www.storyblok.com/docs/libraries/js/content-delivery-api-client */
	region: process.env.STORYBLOK_REGION || 'eu',
	/** The following code is only required when creating a Storyblok space directly via the Blueprints feature. */
	baseUrl: process.env.STORYBLOK_API_BASE_URL
		? new URL(process.env.STORYBLOK_API_BASE_URL).origin
		: undefined,
});

export const { StoryblokBlock } = defineStoryblokBlocks(() => ({
	components: {
		page: Page,
		feature: Feature,
		grid: Grid,
		teaser: Teaser,
	},
}));
