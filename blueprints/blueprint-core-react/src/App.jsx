import useSWR from 'swr';
import { StoryblokPreview } from '@storyblok/react';
import { useParams } from 'react-router';

import { apiClient, StoryblokBlock } from './storyblok';

async function fetchStory(slug) {
	const result = await apiClient.stories.get(slug, {
		query: { version: 'draft' },
	});
	if (!result.data) throw new Error(`Story not found: ${slug}`);
	return result.data.story;
}

export default function App() {
	const currentYear = new Date().getFullYear();
	const { '*': slug } = useParams();
	const { data: story, error } = useSWR(slug || 'home', fetchStory);

	if (error) {
		return <div>Failed to load story.</div>;
	}
	if (!story?.content) {
		return <div>Loading...</div>;
	}
	return (
		<>
			<StoryblokPreview
				story={story}
				renderContent={(liveStory) => <StoryblokBlock block={liveStory.content} />}
			/>
			<footer>All rights reserved © {currentYear}</footer>
		</>
	);
}
