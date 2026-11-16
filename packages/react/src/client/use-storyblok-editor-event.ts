"use client";

import { onStoryblokEditorEvent } from "@storyblok/live-preview";
import type { LivePreviewOptions, LivePreviewStory } from "@storyblok/live-preview";
import type { Story } from "../types";
import { useEffect, useRef } from "react";

/** Options for {@link useStoryblokEditorEvent}. */
export interface UseStoryblokEditorEventOptions {
  /**
   * Milliseconds to wait after the last editor event before invoking the
   * callback. When omitted the callback is invoked immediately on every event.
   */
  debounceMs?: number;
  /**
   * Configuration forwarded to the Preview Bridge constructor, plus
   * `onChange` (replaces the page reload on `change` and `published` events,
   * e.g. with `router.refresh()`) and `onError` (Preview Bridge load
   * failures). The page still reloads unless every live preview subscriber
   * on it passes `onChange`.
   * Captured at mount time — changes after mount have no effect.
   */
  bridgeOptions?: LivePreviewOptions;
}

/**
 * Subscribes to Storyblok Visual Editor events and calls `callback` with the
 * updated story. Handles optional debouncing and unsubscription on unmount.
 *
 * Both `callback` and `options.debounceMs` are tracked via refs so the
 * subscription is established once on mount and never torn down/re-created
 * unless the component unmounts.
 *
 * Each call establishes its own bridge subscription. Sharing one bridge per
 * options key across instances is tracked in
 * https://github.com/storyblok/monoblok/pull/794.
 *
 * @example
 * ```tsx
 * "use client";
 * function Page({ story }: { story: Story }) {
 *   const [current, setCurrent] = useState(story);
 *   useStoryblokEditorEvent((updated) => setCurrent(updated));
 *   return <StoryblokBlock block={current.content} />;
 * }
 * ```
 */
export function useStoryblokEditorEvent<TStory extends Story = Story>(
  callback: (story: LivePreviewStory<TStory>) => void,
  { debounceMs, bridgeOptions }: UseStoryblokEditorEventOptions = {},
): void {
  const callbackRef = useRef(callback);
  const debounceRef = useRef(debounceMs);

  // Sync refs after every commit, never during render.
  // A render discarded by React's concurrent mode must not install its
  // callback, which would cause a stale closure to handle live events.
  useEffect(() => {
    callbackRef.current = callback;
    debounceRef.current = debounceMs;
  });

  useEffect(() => {
    let mounted = true;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    // Synchronous, and never throws: Preview Bridge load failures go to
    // `bridgeOptions.onError` (`console.error` by default).
    const unsubscribe = onStoryblokEditorEvent<TStory>((updatedStory) => {
      if (!mounted) {
        return;
      }

      const ms = debounceRef.current;

      if (ms !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => callbackRef.current(updatedStory), ms);
      } else {
        callbackRef.current(updatedStory);
      }
    }, bridgeOptions);

    return () => {
      mounted = false;
      clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, []);
}
