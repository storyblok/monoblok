// Server-only (`src/lib/server`), so the access token never reaches the browser.
import {
	STORYBLOK_API_BASE_URL,
	STORYBLOK_DELIVERY_API_TOKEN,
	STORYBLOK_REGION,
} from '$app/env/private';
import { createApiClient } from '@storyblok/api-client';

export const apiClient = createApiClient({
	accessToken: STORYBLOK_DELIVERY_API_TOKEN,
	/** Set the correct region for your space. Learn more: https://www.storyblok.com/docs/libraries/js/content-delivery-api-client */
	region: STORYBLOK_REGION || 'eu',
	/** The following code is only required when creating a Storyblok space directly via the Blueprints feature. */
	baseUrl: STORYBLOK_API_BASE_URL ? new URL(STORYBLOK_API_BASE_URL).origin : undefined,
});
