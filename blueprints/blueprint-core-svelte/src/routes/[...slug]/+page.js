import { error } from '@sveltejs/kit';
import { apiClient } from '$lib/storyblok';

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
	const { data } = await apiClient.stories.get(params.slug || 'home', {
		query: { version: 'draft' },
	});
	if (!data) error(404, 'Story not found');

	return {
		story: data.story,
	};
}
