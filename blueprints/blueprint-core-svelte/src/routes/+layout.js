import { apiPlugin, storyblokInit, useStoryblokApi } from '@storyblok/svelte';
import Teaser from '$lib/Teaser.svelte';
import Feature from '$lib/Feature.svelte';
import Grid from '$lib/Grid.svelte';
import Page from '$lib/Page.svelte';

export async function load(params) {
	storyblokInit({
		accessToken: import.meta.env.STORYBLOK_DELIVERY_API_TOKEN,
		apiOptions: {
			/** Set the correct region for your space. Learn more: https://www.storyblok.com/docs/packages/storyblok-js#example-region-parameter */
			region: import.meta.env.STORYBLOK_REGION || 'eu',
			/** The following code is only required when creating a Storyblok space directly via the Blueprints feature. */
			endpoint: import.meta.env.STORYBLOK_API_BASE_URL
				? `${new URL(import.meta.env.STORYBLOK_API_BASE_URL).origin}/v2`
				: undefined,
		},
		use: [apiPlugin],
		components: {
			teaser: Teaser,
			feature: Feature,
			grid: Grid,
			page: Page,
		},
	});

	const storyblokAPI = await useStoryblokApi();

	return {
		storyblokAPI,
	};
}
