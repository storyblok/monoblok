import { error } from '@sveltejs/kit';
import { apiClient } from '$lib/storyblok';

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
	const { data, error: apiError } = await apiClient.stories.get(params.slug || 'home', {
		query: { version: 'draft' },
	});
	if (apiError?.response.status === 404) error(404, 'Story not found');
	// A wrong token or region, a rate limit or a network failure: surface it instead of a 404.
	if (!data) throw apiError ?? new Error('Failed to fetch story');

	return {
		story: data.story,
	};
}
