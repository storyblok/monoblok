import { notFound } from 'next/navigation';
import { StoryblokPreview } from '@storyblok/react/rsc';
import { getApiClient } from '@/lib/storyblok';
import { renderContent } from '@/lib/actions';

export default async function Page({ params }) {
	const { slug } = await params;

	const fullSlug = slug ? slug.join('/') : 'home';

	const result = await getApiClient().stories.get(fullSlug, {
		query: { version: 'draft' },
	});

	if (result.error) {
		throw result.error;
	}

	if (!result.data?.story) {
		notFound();
	}

	return <StoryblokPreview story={result.data.story} renderContent={renderContent} />;
}
