import { forwardRef } from 'react';
import type { ISbStoryData } from '@/types';
import StoryblokServerComponent from './server-component';

interface StoryblokServerStoryProps extends Omit<Record<string, unknown>, 'story'> {
  story: ISbStoryData;
}

/**
 * Shared server component for rendering Storyblok stories.
 * Works in both SSR and RSC contexts without server actions.
 */
const StoryblokServerStory = forwardRef<HTMLElement, StoryblokServerStoryProps>(
  ({ story, ...restProps }: StoryblokServerStoryProps, ref) => {
    if (!story) {
      console.error(
        'Please provide a \'story\' property to the StoryblokServerStory',
      );
      return null;
    }

    // Handle cached story updates (for revalidation scenarios)
    if (globalThis.storyCache?.has(story.uuid)) {
      story = globalThis.storyCache.get(story.uuid);
      // Delete the story from the cache to avoid draft content leaking
      globalThis.storyCache.delete(story.uuid);
    }

    // Parse story content if it's a string
    if (typeof story.content === 'string') {
      try {
        story.content = JSON.parse(story.content);
      }
      catch (error) {
        console.error(
          'An error occurred while trying to parse the story content',
          error,
        );
        story.content = {};
      }
    }

    return (
      <StoryblokServerComponent ref={ref} blok={story.content} {...restProps} />
    );
  },
);

export default StoryblokServerStory;
