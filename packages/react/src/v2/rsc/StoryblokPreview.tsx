'use client';
import { onStoryblokEditorEvent } from '@storyblok/live-preview';
import type { Story } from '@storyblok/api-client';
import {
  type ReactNode,
  useEffect,
  useState,
  useTransition,
} from 'react';

export interface StoryblokPreviewProps {
  /**
   * Server action responsible for rendering updated content.
   */
  renderContent: (
    story: Story,
  ) => Promise<ReactNode>;
  /**
   * Initial server-rendered content.
   */
  initialContent: ReactNode;
}

export function StoryblokPreview({
  renderContent,
  initialContent,
}: StoryblokPreviewProps) {
  const [isPending, startTransition] = useTransition();

  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      unsubscribe = await onStoryblokEditorEvent((updatedStory) => {
        if (!mounted) {
          return;
        }

        startTransition(async () => {
          try {
            const next = await renderContent(updatedStory as Story);

            if (mounted) {
              setContent(next);
            }
          }
          catch (err) {
            console.error(
              '[StoryblokPreview] Failed to render preview:',
              err,
            );
          }
        });
      });
    };

    setup();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [renderContent]);

  return (
    <>
      {isPending && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: '#3b82f6',
            zIndex: 9999,
          }}
        />
      )}

      {content}
    </>
  );
}

export default StoryblokPreview;
