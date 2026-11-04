import { useEffect, useState } from 'react';
import { StoryblokPreview } from '@storyblok/react';
import { useParams } from 'react-router';

import { apiClient, StoryblokBlock } from './storyblok';

export default function App() {
	const currentYear = new Date().getFullYear();
	const { '*': slug } = useParams();
	const [story, setStory] = useState(null);

	useEffect(() => {
		let ignore = false;
		apiClient.stories
			.get(slug || 'home', { query: { version: 'draft' } })
			.then((result) => {
				if (!ignore) setStory(result.data?.story ?? null);
			});
		return () => {
			ignore = true;
		};
	}, [slug]);

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
