'use server';

import { StoryblokBlock } from '@/lib/storyblok';

/**
 * Renders the story on the server. `StoryblokPreview` calls it for the first
 * paint and again on every Visual Editor update.
 */
export async function renderContent(story) {
	return story.content ? <StoryblokBlock block={story.content} /> : null;
}
