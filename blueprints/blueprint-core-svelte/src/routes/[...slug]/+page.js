/** @type {import('./$types').PageLoad} */
export async function load({ params, parent }) {
	const { storyblokAPI } = await parent();

	const response = await storyblokAPI.get(
		`cdn/stories/${params.slug || 'home'}`,
		{
			version: 'draft',
		},
	);

	return {
		story: response.data.story,
	};
}
