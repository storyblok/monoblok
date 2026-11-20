import { forwardRef } from 'react';
import type { ISbStoryData, StoryblokBridgeConfigV2 } from '@/types';
import StoryblokServerComponent from '../server/server-component';
import { getOmittedRenderPropNames, toLiveEditRenderProps } from './live-edit-props';
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

    // The live editing Server Action is imported lazily by the client component,
    // never from here: Next.js 13 refuses to compile a `"use server"` module
    // imported into the Server Component graph unless Server Actions are enabled.
    const omittedRenderProps = getOmittedRenderPropNames(restProps);
    return (
      <StoryblokLiveEditing
        story={story}
        bridgeOptions={bridgeOptions}
        renderProps={toLiveEditRenderProps(restProps)}
        omittedRenderProps={omittedRenderProps.length ? omittedRenderProps : undefined}
      >
        <StoryblokServerComponent ref={ref} blok={story.content} {...restProps} />
      </StoryblokLiveEditing>
    );
  },
);

export default StoryblokStory;
