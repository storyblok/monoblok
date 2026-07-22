'use client';
import { onStoryblokEditorEvent } from '@storyblok/live-preview';
import type { Story } from '@storyblok/api-client';
import {
  type ReactNode,
  useEffect,
  useRef,
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
   * Initial server-rendered content passed as children.
   *
   * Pass the initial RSC tree as children (not as a prop) so that React can
   * stream it through the RSC channel. Storing async Server Component output
   * in useState(initialContent) forces the RSC serializer to fully await every
   * async component before sending any HTML, bypassing Suspense streaming.
   * Using children keeps the subtree in the RSC stream where Suspense works.
   */
  children: ReactNode;
  /**
   * Milliseconds to wait after the last editor event before triggering a
   * re-render. Prevents a Server Action call on every individual keystroke.
   *
   * Defaults to 300 ms — enough to let a fast typist finish a word before
   * the preview updates, while still feeling responsive.
   */
  debounceMs?: number;
}

export function StoryblokPreview({
  renderContent,
  children,
  debounceMs = 300,
}: StoryblokPreviewProps) {
  const [isPending, startTransition] = useTransition();

  // null = no editor update yet; renders children (initial RSC tree) instead.
  const [updatedContent, setUpdatedContent] = useState<ReactNode | null>(null);

  // Holds the pending debounce timer so we can cancel it when a new event
  // arrives before the delay expires.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      unsubscribe = await onStoryblokEditorEvent((updatedStory) => {
        if (!mounted) {
          return;
        }

        // Cancel the previous pending re-render and wait for the user to
        // pause before kicking off a new Server Action call. Without this,
        // every keystroke would fire a separate (potentially slow) fetch.
        if (debounceTimer.current !== null) {
          clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
          debounceTimer.current = null;

          startTransition(async () => {
            try {
              const next = await renderContent(updatedStory as Story);

              if (mounted) {
                setUpdatedContent(next);
              }
            }
            catch (err) {
              console.error(
                '[StoryblokPreview] Failed to render preview:',
                err,
              );
            }
          });
        }, debounceMs);
      });
    };

    setup();

    return () => {
      mounted = false;
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }
      unsubscribe?.();
    };
  }, [renderContent, debounceMs]);

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

      {updatedContent ?? children}
    </>
  );
}

export default StoryblokPreview;
