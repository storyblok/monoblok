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
 *
 * Keeping it separate means use() only suspends this subtree, not the whole
 * page. Once the promise resolves, onCommit is called so the parent can
 * advance its Suspense fallback to this freshly rendered content.
 */
function LiveContent({
  promise,
  onCommit,
}: {
  promise: Promise<ReactNode>;
  onCommit: (content: ReactNode) => void;
}) {
  const content = use(promise);

  // After use() resolves, persist this content as the next fallback so that
  // a subsequent editor update shows the latest rendered state instead of
  // jumping back to the original SSR snapshot.
  useEffect(() => {
    onCommit(content);
  }, [content, onCommit]);

  return <>{content}</>;
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
  // Storing a Promise lets React.use() + Suspense handle async resolution
  // progressively: the initial RSC shell (with skeleton fallbacks) arrives
  // quickly, and slow components like WeatherWidget stream in independently.
  const [livePromise, setLivePromise] = useState<Promise<ReactNode> | null>(
    null,
  );

  // Tracks the last successfully committed content.
  //
  // Starts as the initial SSR children. Updated by LiveContent via onCommit
  // each time a renderContent promise resolves.
  //
  // Without this, the Suspense fallback always shows the original SSR
  // snapshot. After edit #1 resolves and the user makes edit #2, the page
  // would jump back to stale content while the new render is in flight.
  const [fallback, setFallback] = useState<ReactNode>(children);

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
          // React.use() inside LiveContent reads it; the Suspense boundary
          // shows `fallback` (current committed content) while the server
          // action streams its RSC response.
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
  // Show the last committed content as the Suspense fallback so the page
  // stays visible while the server action streams its response.
  return (
    <Suspense fallback={<>{fallback}</>}>
      <LiveContent promise={livePromise} onCommit={setFallback} />
    </Suspense>
  );
}

export default StoryblokPreview;
