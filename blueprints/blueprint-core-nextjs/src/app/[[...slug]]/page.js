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

	// A missing story comes back as a 404 error, so check for it before
	// rethrowing every other failure.
	if (result.error?.response.status === 404) {
		notFound();
	}

	if (result.error) {
		throw result.error;
	}

	return <StoryblokPreview story={result.data.story} renderContent={renderContent} />;
}
