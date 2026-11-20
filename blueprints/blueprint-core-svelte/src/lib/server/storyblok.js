// Server-only (`$lib/server`), so the access token never reaches the browser.
import { createApiClient } from '@storyblok/api-client';

export const apiClient = createApiClient({
	accessToken: import.meta.env.STORYBLOK_DELIVERY_API_TOKEN ?? '',
	/** Set the correct region for your space. Learn more: https://www.storyblok.com/docs/libraries/js/content-delivery-api-client */
	region: import.meta.env.STORYBLOK_REGION || 'eu',
	/** The following code is only required when creating a Storyblok space directly via the Blueprints feature. */
	baseUrl: import.meta.env.STORYBLOK_API_BASE_URL
		? new URL(import.meta.env.STORYBLOK_API_BASE_URL).origin
		: undefined,
});
