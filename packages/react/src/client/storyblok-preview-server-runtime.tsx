"use client";
import type { BridgeParams, LivePreviewStory } from "@storyblok/live-preview";
// `React` namespace is imported so `Reflect.get(React, "use")` can be used to
// resolve React.use at runtime without a static named import. Static named
// imports (and even `React["use"]` string-key lookups) are folded by Webpack
// into module-graph edges that fail on React <19, even when the import is never
// executed. Reflect.get is opaque to bundler static analysis.
import * as React from "react";
import {
  Component,
  type ReactNode,
  startTransition,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { useStoryblokEditorEvent } from "./use-storyblok-editor-event";

/**
 * Props for {@link StoryblokPreviewServerRuntime}.
 *
 * This component is an internal implementation detail. It is not exported
 * from `@storyblok/react/rsc` — it is only ever rendered by the `async`
 * `StoryblokPreview` in `@storyblok/react/rsc`, after that component has
 * already awaited `renderContent` once for the initial paint.
 */
export interface StoryblokPreviewServerRuntimeProps {
  /**
   * Server Action responsible for rendering updated content on every editor
   * event. Already called once by the caller to produce `children` — this
   * component only calls it again on subsequent editor events.
   */
  renderContent: (story: LivePreviewStory) => Promise<ReactNode>;
  /**
   * Initial server-rendered content (the result of the caller's first call
   * to `renderContent`).
   *
   * Returned directly on first render with no state involvement, so Suspense
   * boundaries inside the tree (e.g. WeatherWidget) stream normally.
   *
   * IMPORTANT: never store this in useState. Storing a ReactNode that contains
   * async server components in useState forces the RSC serialiser to fully
   * await every async component in the tree before it can send the initial
   * HTML, bypassing Suspense streaming and causing a blank page for the full
   * duration of the slowest component. This component never does that —
   * `children` is only ever returned directly, both here and in
   * `LiveContentBoundary`'s fallback.
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
// even when this module is loaded on a page that never renders
// StoryblokPreviewServerRuntime, because the bundler validates all named
// exports at module-graph construction time.
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
 * the module can be loaded on React <19 without a module-graph error.
 */
function LiveContent({
  promise,
  children,
}: {
  promise: Promise<ReactNode> | null;
  children: ReactNode;
}) {
  if (!promise) {
    return <>{children}</>;
  }

  // reactUse is guaranteed to be defined here: StoryblokPreviewServerRuntime
  // throws before rendering LiveContent when React <19 is detected.
  const content = reactUse!(promise);
  return <>{content}</>;
}

// ── Error boundary ────────────────────────────────────────────────────────────

interface LiveContentBoundaryProps {
  promise: Promise<ReactNode> | null;
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
    console.error("[Storyblok] StoryblokPreview: renderContent failed.", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ── StoryblokPreviewServerRuntime ────────────────────────────────────────────

/**
 * Client-side runtime for RSC live preview. Listens for Storyblok Visual
 * Editor events and invokes `renderContent` — a Server Action — with the
 * updated story to produce fresh server-rendered output. The promise update
 * is wrapped in `startTransition` so React keeps the current tree on screen
 * while the action is in flight instead of showing a Suspense fallback, which
 * eliminates the duplicate-DOM window that confuses the bridge.
 *
 * If `renderContent` rejects, the error boundary catches it, logs it, and keeps
 * the initial `children` visible. The boundary resets on the next editor event.
 */
export function StoryblokPreviewServerRuntime({
  renderContent,
  children,
  debounceMs = 200,
  bridgeOptions,
}: StoryblokPreviewServerRuntimeProps): ReactNode {
  // Runtime guard for React <19. React.use is not available before React 19,
  // which is required for the Suspense-based live preview to work.
  // Note: this guard cannot be covered by unit tests because the React module
  // namespace is sealed in the test environment. It is verified manually.
  if (typeof reactUse !== "function") {
    throw new Error(
      "[Storyblok] StoryblokPreview (server mode, from @storyblok/react/rsc) requires React 19 " +
        "(React.use is not available). Use StoryblokPreview from @storyblok/react for React 17/18.",
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
  const mounted = useRef(true);

  useEffect(() => {
    // Strict Mode (React 18+ dev) mounts, cleans up, then remounts the same
    // component instance to surface missing cleanup handling. The cleanup
    // below flips `mounted` to false; reset it here so the simulated
    // remount — and every real mount — starts with `mounted` true again.
    mounted.current = true;

    return () => {
      mounted.current = false;
      queued.current = null;
    };
  }, []);

  function run(story: LivePreviewStory) {
    if (!mounted.current) {
      return;
    }

    inFlight.current = true;
    // Call renderContent eagerly (outside the transition) so the Server Action
    // starts streaming its RSC response immediately.
    const promise = renderContent(story).finally(() => {
      inFlight.current = false;

      if (!mounted.current) {
        return;
      }

      const next = queued.current;
      queued.current = null;
      if (next) {
        run(next);
      }
    });
    // Suppress the unhandled-rejection warning that fires in the window between
    // setLivePromise and React's use() subscribing to the promise. React.use()
    // handles the rejection by throwing to the error boundary; this no-op catch
    // exists only to satisfy the JS engine's "unhandled rejection" detector.
    promise.catch(() => {});
    // Wrap setLivePromise in startTransition so React keeps the current tree on
    // screen while LiveContent re-suspends, preventing the duplicate-DOM window
    // that confuses the bridge.
    if (mounted.current) {
      startTransition(() => setLivePromise(promise));
    }
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

  return (
    <LiveContentBoundary promise={livePromise} fallback={<>{children}</>}>
      <Suspense fallback={<>{children}</>}>
        <LiveContent promise={livePromise}>{children}</LiveContent>
      </Suspense>
    </LiveContentBoundary>
  );
}
