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
   * boundaries inside the tree (e.g. WeatherWidget) stream normally.
   *
   * IMPORTANT: never store this in useState. Storing a ReactNode that contains
   * async server components in useState forces the RSC serialiser to fully
   * await every async component in the tree before it can send the initial
   * HTML, bypassing Suspense streaming and causing a blank page for the full
   * duration of the slowest component.
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
 * page. Once the promise resolves, onCommit is called so the parent can
 * advance the Suspense fallback to the freshly rendered content.
 */
function LiveContent({
  promise,
  onCommit,
}: {
  promise: Promise<ReactNode>;
  onCommit: (content: ReactNode) => void;
}) {
  const content = use(promise);

  // After use() resolves, persist the content so subsequent editor updates
  // show the most-recent rendered state as the fallback rather than the
  // original SSR snapshot.
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
  // bypassing Suspense streaming and causing a full blank-page wait.
  //
  // Storing a Promise lets React.use() + Suspense handle async resolution
  // progressively: the initial RSC shell (with skeleton fallbacks) can arrive
  // quickly, and slow components stream in independently.
  const [livePromise, setLivePromise] = useState<Promise<ReactNode> | null>(
    null,
  );

  // Tracks the last successfully committed content from a renderContent call.
  //
  // Initialized to null — NOT to `children`. Storing `children` here would
  // have the same effect as any other named prop: the RSC serialiser would
  // need to fully await every async component in the tree (e.g. WeatherWidget
  // with a 10 s fetch) before committing the state, blocking the initial HTML.
  //
  // The Suspense fallback uses `committedContent ?? children`:
  //   • Before the first renderContent resolves: children is used directly
  //     from the prop (stays in the RSC streaming channel — safe).
  //   • After the first renderContent resolves: committedContent holds the
  //     server-rendered output (fully resolved, safe to store in state).
  //     Subsequent editor updates show the latest committed state as the
  //     fallback instead of jumping back to the original SSR snapshot.
  const [committedContent, setCommittedContent] = useState<ReactNode | null>(
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
          // React.use() inside LiveContent reads it; the Suspense boundary
          // shows the fallback while the server action streams its RSC response.
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
  // children tree (e.g. WeatherWidget) fire normally because nothing here
  // interferes with them.
  if (!livePromise) {
    return <>{children}</>;
  }

  // Editor update in flight or resolved.
  //
  // Fallback precedence:
  //   1. committedContent — output of the last resolved renderContent call.
  //      Fully resolved server-rendered content; safe in state.
  //   2. children — the initial SSR tree accessed directly from the prop
  //      (never from state) so it stays in the RSC streaming channel.
  //
  // This means the page always shows the most-recently committed state while
  // a new render is in flight, and never reverts to the original SSR snapshot
  // after the first editor update has already resolved.
  return (
    <Suspense fallback={<>{committedContent ?? children}</>}>
      <LiveContent promise={livePromise} onCommit={setCommittedContent} />
    </Suspense>
  );
}

export default StoryblokPreview;
