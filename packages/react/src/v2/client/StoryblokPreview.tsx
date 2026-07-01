import { onStoryblokEditorEvent } from '@storyblok/live-preview';
import type { Story } from '@storyblok/api-client';
import {
  type ReactNode,
  useEffect,
  useState,
} from 'react';

export interface StoryblokPreviewProps {
  /**
   * Initial story fetched by the application.
   */
  story: Story;

  /**
   * Render function that receives the latest story.
   */
  children: (story: Story) => ReactNode;
}

export function StoryblokPreview({
  story,
  children,
}: StoryblokPreviewProps) {
  const [currentStory, setCurrentStory] = useState(story);
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      unsubscribe = await onStoryblokEditorEvent((updatedStory) => {
        if (!mounted) {
          return;
        }
        setCurrentStory(updatedStory as Story);
      });
    };

    setup();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  return <>{children(currentStory)}</>;
}

export default StoryblokPreview;
