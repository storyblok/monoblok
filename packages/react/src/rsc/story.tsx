import { forwardRef } from 'react';
import type { ISbStoryData, StoryblokBridgeConfigV2 } from '@/types';
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

    const uuidKey = story.uuid;
    const idKey = typeof story.id === 'number' ? `id:${story.id}` : null;

    if (globalThis?.storyCache.has(uuidKey)) {
      story = globalThis.storyCache.get(uuidKey);
    }
    else if (idKey && globalThis?.storyCache.has(idKey)) {
      // Visual History fallback: the cached payload is minimal (`{ id, content }`),
      // so merge it on top of the server-fetched story to keep slug/full_slug/etc.
      const cached = globalThis.storyCache.get(idKey);
      story = { ...story, ...cached };
    }

    // Clear both possible keys for this story so a stale Visual History payload
    // can't replay on a later render (e.g. after a subsequent live-edit consumes
    // the uuid entry but leaves an older id-keyed entry behind).
    globalThis?.storyCache.delete(uuidKey);
    if (idKey) {
      globalThis?.storyCache.delete(idKey);
    }

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
