"use client";
import type { BridgeParams, LivePreviewStory } from "@storyblok/live-preview";
// `React` namespace imported separately so `React.use` is a runtime property
// lookup rather than a static named import. This means the module loads on
// React <19 without a SyntaxError, even though StoryblokPreviewRsc itself
// requires React 19 to function.
import * as React from "react";
import { Component, type ReactNode, startTransition, Suspense, useState } from "react";
import { useStoryblokEditorEvent } from "./use-storyblok-editor-event";

/** Props for the {@link StoryblokPreviewRsc} component. */
export interface StoryblokPreviewRscProps {
  /**
   * Server action responsible for rendering updated content.
   */
  renderContent: (story: LivePreviewStory) => Promise<ReactNode>;
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
   * Defaults to 200 ms.
   */
  debounceMs?: number;
  /**
   * Configuration forwarded to the Preview Bridge constructor.
   * Captured at mount time — changes after mount have no effect.
   */
  bridgeOptions?: BridgeParams;
}

// ── LiveContent ───────────────────────────────────────────────────────────────

/**
 * Inner component that calls React.use() inside its own Suspense boundary.
 * Keeping it separate means use() only suspends this subtree, not the whole page.
 *
 * React.use is accessed via the React namespace (not a static named import) so
 * that the module can be loaded on React <19 without a parse error — consumers
 * who only import StoryblokPreview / useStoryblokState are unaffected.
 */
function LiveContent({ promise }: { promise: Promise<ReactNode> }) {
  const content = React.use(promise);
  return <>{content}</>;
}

// ── Error boundary ────────────────────────────────────────────────────────────

interface LiveContentBoundaryProps {
  promise: Promise<ReactNode>;
  fallback: ReactNode;
  children: ReactNode;
}
interface LiveContentBoundaryState {
  hasError: boolean;
  /** The promise that triggered the current error, used to self-reset on the next attempt. */
  capturedPromise: Promise<ReactNode> | null;
}

/**
 * Catches rejections thrown by React.use() inside LiveContent (e.g. a failed
 * Server Action) and shows the provided fallback — the initial SSR children —
 * instead of crashing the page. Resets automatically when a new promise
 * arrives from the next editor event.
 */
class LiveContentBoundary extends Component<LiveContentBoundaryProps, LiveContentBoundaryState> {
  state: LiveContentBoundaryState = { hasError: false, capturedPromise: null };

  static getDerivedStateFromError(): Partial<LiveContentBoundaryState> {
    return { hasError: true };
  }

  // Reset when a new promise arrives — each editor event is a fresh retry opportunity.
  static getDerivedStateFromProps(
    { promise }: LiveContentBoundaryProps,
    { hasError, capturedPromise }: LiveContentBoundaryState,
  ): Partial<LiveContentBoundaryState> | null {
    if (hasError && capturedPromise !== null && capturedPromise !== promise) {
      return { hasError: false, capturedPromise: null };
    }
    // Latch the promise that caused the error so the next comparison works.
    if (hasError && capturedPromise === null) {
      return { capturedPromise: promise };
    }
    return null;
  }

  componentDidCatch(error: unknown) {
    console.error("[Storyblok] StoryblokPreviewRsc: renderContent failed.", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ── StoryblokPreviewRsc ───────────────────────────────────────────────────────

/**
 * Client component that enables live preview for React Server Component (RSC) routes.
 *
 * Listens for Storyblok Visual Editor events and invokes `renderContent` — a
 * Server Action — with the updated story to produce fresh server-rendered output.
 * The promise update is wrapped in `startTransition` so React keeps the current
 * tree on screen while the action is in flight instead of showing a Suspense
 * fallback, which eliminates the duplicate-DOM window that confuses the bridge.
 *
 * If `renderContent` rejects, the error boundary catches it, logs it, and keeps
 * the initial `children` visible. The boundary resets on the next editor event.
 *
 * Wrap your RSC page output with this component and pass a Server Action as
 * `renderContent`. The initial server-rendered tree is passed as `children` and
 * rendered with zero client-state involvement so RSC Suspense streaming works
 * normally on first load.
 *
 * @example
 * ```tsx
 * // app/[slug]/page.tsx (Server Component)
 * export default async function Page({ params }) {
 *   const story = await fetchStory(params.slug);
 *   return (
 *     <StoryblokPreviewRsc renderContent={renderStory} >
 *       <MyStoryContent story={story} />
 *     </StoryblokPreviewRsc>
 *   );
 * }
 * ```
 */
export function StoryblokPreviewRsc({
  renderContent,
  children,
  debounceMs = 200,
  bridgeOptions,
}: StoryblokPreviewRscProps) {
  // Runtime guard for React <19. React.use is not available before React 19,
  // which is required for the Suspense-based live preview to work.
  // Note: this guard cannot be covered by unit tests because the React module
  // namespace is sealed in the test environment. It is verified manually.
  if (typeof React.use !== "function") {
    throw new Error(
      "[Storyblok] StoryblokPreviewRsc requires React 19 (React.use is not available). " +
        "Use StoryblokPreview for React 17/18.",
    );
  }

  const [livePromise, setLivePromise] = useState<Promise<ReactNode> | null>(null);

  useStoryblokEditorEvent(
    (updatedStory) => {
      // Call renderContent eagerly (outside the transition) so the Server Action
      // starts streaming its RSC response immediately.
      // Wrapping setLivePromise in startTransition tells React to keep the
      // current tree on screen while LiveContent re-suspends, which prevents
      // the fallback from showing and the duplicate-DOM window it creates.
      const promise = renderContent(updatedStory);
      startTransition(() => setLivePromise(promise));
    },
    { debounceMs, bridgeOptions },
  );

  // No editor update yet — return children with zero state involvement.
  // This is the initial SSR/streaming path: Suspense boundaries inside the
  // children tree (e.g. WeatherWidget) fire normally because nothing here
  // interferes with them.
  if (!livePromise) {
    return <>{children}</>;
  }

  return (
    <LiveContentBoundary promise={livePromise} fallback={<>{children}</>}>
      <Suspense fallback={<>{children}</>}>
        <LiveContent promise={livePromise} />
      </Suspense>
    </LiveContentBoundary>
  );
}
