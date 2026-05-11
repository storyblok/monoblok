import { forwardRef } from 'react';
import type { ISbStoryData, StoryblokBridgeConfigV2 } from '@/types';
import { consumeCachedStory } from '../core/story-cache';
import StoryblokServerComponent from '../server/server-component';
import StoryblokLiveEditing from './live-editing';

interface StoryblokStoryProps extends Omit<Record<string, unknown>, 'story' | 'bridgeOptions'> {
  story: ISbStoryData;
  bridgeOptions?: StoryblokBridgeConfigV2;
}

const StoryblokStory = forwardRef<HTMLElement, StoryblokStoryProps>(
  ({ story, bridgeOptions, ...restProps }: StoryblokStoryProps, ref) => {
    if (!story) {
      console.error(
        'Please provide a \'story\' property to the StoryblokServerComponent',
      );
      return null;
    }

    story = consumeCachedStory(story);

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
      <>
        <StoryblokServerComponent ref={ref} blok={story.content} {...restProps} />
        <StoryblokLiveEditing story={story} bridgeOptions={bridgeOptions} />
      </>
    );
  },
);

export default StoryblokStory;
