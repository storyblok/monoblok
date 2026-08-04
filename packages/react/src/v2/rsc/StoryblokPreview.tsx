'use client';
import { onStoryblokEditorEvent } from '@storyblok/live-preview';
import type { Story } from '@storyblok/api-client';
import {
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useRef,
  useState,
} from 'react';

export interface StoryblokPreviewProps {
  /**
   * Server action responsible for rendering updated content.
   */
  renderContent: (story: Story) => Promise<ReactNode>;
  /**
   * Initial server-rendered content passed as children.
   *
   * Returned directly on first render with no state involvement, so Suspense
   * boundaries inside the tree stream normally.
   */
  children: ReactNode;
  /**
   * Milliseconds to wait after the last editor event before triggering a
   * re-render. Prevents a Server Action call on every individual keystroke.
   *
   * Defaults to 300 ms.
   */
  debounceMs?: number;
}

/**
 * Inner component that calls use() inside its own Suspense boundary.
 * Keeping it separate means use() only suspends this subtree, not the whole
 * page.
 */
function LiveContent({ promise }: { promise: Promise<ReactNode> }) {
  return <>{use(promise)}</>;
}

export function StoryblokPreview({
  renderContent,
  children,
  debounceMs = 300,
}: StoryblokPreviewProps) {
  // Store the Promise itself — not the resolved ReactNode.
  //
  // Storing ReactNode in useState forces the RSC serializer to fully await
  // every async component in the tree before it can commit the state value,
  // bypassing Suspense streaming and causing a full 10-second block.
  //
  // Storing a Promise avoids this: React.use() + Suspense handle the async
  // resolution on the client after the initial page has already streamed.
  const [livePromise, setLivePromise] = useState<Promise<ReactNode> | null>(
    null,
  );

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      unsubscribe = await onStoryblokEditorEvent((updatedStory) => {
        if (!mounted) {
          return;
        }

        if (debounceTimer.current !== null) {
          clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
          debounceTimer.current = null;
          if (!mounted) {
            return;
          }

          // Set the promise directly — no useTransition, no awaiting here.
          // React.use() inside LiveContent reads it; Suspense shows children
          // (current content) as the fallback while the new render loads.
          setLivePromise(renderContent(updatedStory as Story));
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

  // No editor update yet — return children with zero state involvement.
  // This is the initial SSR/streaming path: Suspense boundaries inside the
  // children tree fire normally because nothing here interferes with them.
  if (!livePromise) {
    return <>{children}</>;
  }

  // Editor update in flight or resolved.
  // Show the current content (children) as the Suspense fallback so the page
  // stays visible while the server action completes, then swaps seamlessly.
  return (
    <Suspense fallback={children}>
      <LiveContent promise={livePromise} />
    </Suspense>
  );
}

export default StoryblokPreview;
