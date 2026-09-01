"use client";
import type { BridgeParams, LivePreviewStory } from "@storyblok/live-preview";
// `React` namespace is imported so `Reflect.get(React, "use")` can be used to
// resolve React.use at runtime without a static named import. Static named
// imports (and even `React["use"]` string-key lookups) are folded by Webpack
// into module-graph edges that fail on React <19, even when the import is never
// executed. Reflect.get is opaque to bundler static analysis.
import * as React from "react";
import { Component, type ReactNode, startTransition, Suspense, useRef, useState } from "react";
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

// ── reactUse ──────────────────────────────────────────────────────────────────

// Resolved at module-evaluation time via Reflect.get so that no bundler
// (Webpack, Rollup, esbuild) can statically rewrite this into a named import
// of `use` from `react`. A named import would cause a hard error on React <19
// even when this module is imported by a pages-router app that never renders
// StoryblokPreviewRsc, because the bundler validates all named exports at
// module-graph construction time.
//
// `React["use"]` with a string-literal key is NOT sufficient — Webpack folds
// that into a named import too. `Reflect.get` is opaque to static analysis.
const reactUse = Reflect.get(React, "use") as (<T>(p: Promise<T>) => T) | undefined;

// ── LiveContent ───────────────────────────────────────────────────────────────

/**
 * Inner component that calls React.use() inside its own Suspense boundary.
 * Keeping it separate means use() only suspends this subtree, not the whole page.
 *
 * `reactUse` is resolved via Reflect.get (not a static named import) so that
 * the module can be loaded on React <19 without a module-graph error — consumers
 * who only import StoryblokPreview / useStoryblokState are unaffected.
 */
function LiveContent({ promise }: { promise: Promise<ReactNode> }) {
  // reactUse is guaranteed to be defined here: StoryblokPreviewRsc throws
  // before rendering LiveContent when React <19 is detected.
  const content = reactUse!(promise);
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
  if (typeof reactUse !== "function") {
    throw new Error(
      "[Storyblok] StoryblokPreviewRsc requires React 19 (React.use is not available). " +
        "Use StoryblokPreview for React 17/18.",
    );
  }

  const [livePromise, setLivePromise] = useState<Promise<ReactNode> | null>(null);

  // One server action at a time. A story arriving while an action is in-flight
  // is held in `queued` (replacing any earlier queued story) and dispatched once
  // the current action settles. This bounds concurrent server work to one action
  // instead of one per debounce window, preventing redundant re-fetches in every
  // async Server Component in the subtree.
  const inFlight = useRef(false);
  const queued = useRef<LivePreviewStory | null>(null);

  function run(story: LivePreviewStory) {
    inFlight.current = true;
    // Call renderContent eagerly (outside the transition) so the Server Action
    // starts streaming its RSC response immediately.
    const promise = renderContent(story).finally(() => {
      inFlight.current = false;
      const next = queued.current;
      queued.current = null;
      if (next) run(next);
    });
    // Suppress the unhandled-rejection warning that fires in the window between
    // setLivePromise and React's use() subscribing to the promise. React.use()
    // handles the rejection by throwing to the error boundary; this no-op catch
    // exists only to satisfy the JS engine's "unhandled rejection" detector.
    promise.catch(() => {});
    // Wrap setLivePromise in startTransition so React keeps the current tree on
    // screen while LiveContent re-suspends, preventing the duplicate-DOM window
    // that confuses the bridge.
    startTransition(() => setLivePromise(promise));
  }

  useStoryblokEditorEvent(
    (updatedStory) => {
      if (inFlight.current) {
        // Replace any previously queued story with the latest — intermediate
        // stories are intentionally discarded.
        queued.current = updatedStory;
        return;
      }
      run(updatedStory);
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
