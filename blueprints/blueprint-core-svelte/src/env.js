import { defineEnvVars } from '@sveltejs/kit/env';

// Private (server-only) variables, read from `.env` or the environment when the app starts.
// Import them from `$app/env/private`. Learn more: https://svelte.dev/docs/kit/environment-variables
export const variables = defineEnvVars({
	// Optional, so the app also builds without a `.env` file.
	STORYBLOK_DELIVERY_API_TOKEN: { schema: (value) => value ?? '' },
	STORYBLOK_REGION: { schema: (value) => value },
	STORYBLOK_API_BASE_URL: { schema: (value) => value },
});
