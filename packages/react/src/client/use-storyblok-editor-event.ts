"use client";

import { useEffect, useRef } from "react";
import { onStoryblokEditorEvent } from "@storyblok/live-preview";
import type { LivePreviewOptions, LivePreviewStory } from "@storyblok/live-preview";
import type { Story } from "../types";

/** Options for {@link useStoryblokEditorEvent}. */
export type UseStoryblokEditorEventOptions = {
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
};

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
 *   const [current, setCurrent] = useState<LivePreviewStory>(story);
 *   useStoryblokEditorEvent((updated) => {
 *     // Editor events aren't scoped to one story.
 *     if (updated.id === story.id) {
 *       setCurrent(updated);
 *     }
 *   });
 *   return current.content ? <StoryblokBlock block={current.content} /> : null;
 * }
 * ```
 */
export function useStoryblokEditorEvent<TStory extends Story = Story>(
  callback: (story: LivePreviewStory<TStory>) => void,
  { debounceMs, bridgeOptions }: UseStoryblokEditorEventOptions = {},
): void {
  useEditorEvent(callback, { debounceMs, bridgeOptions });
}

/** Options for {@link useEditorEvent}. Internal: not exported from the package. */
export type EditorEventOptions = UseStoryblokEditorEventOptions & {
  /**
   * Only handle editor events for the story with this id. Editor events
   * aren't scoped to one story, so a page preview and a nav preview on the
   * same page would otherwise both take whichever story is being edited.
   * Events for another story are dropped before debouncing, so they never
   * replace a pending update for this one. Read on every event, so a new id
   * after a client-side navigation applies immediately.
   */
  storyId?: Story["id"];
  /**
   * Drop stories without `content`, which the Preview Bridge sends while the
   * editor shows a previous version (visual history). Dropped before
   * debouncing, so such an event never cancels a pending update. Read at
   * mount time.
   */
  skipWithoutContent?: boolean;
};

/**
 * Implementation of {@link useStoryblokEditorEvent}, plus the internal
 * `storyId` and `skipWithoutContent` filters used by `useStoryblokState` and
 * the server-mode preview runtime. Not exported from the package.
 */
export function useEditorEvent<TStory extends Story = Story>(
  callback: (story: LivePreviewStory<TStory>) => void,
  { debounceMs, storyId, skipWithoutContent = false, bridgeOptions }: EditorEventOptions = {},
): void {
  const callbackRef = useRef(callback);
  const debounceRef = useRef(debounceMs);
  const storyIdRef = useRef(storyId);

  // Sync refs after every commit, never during render.
  // A render discarded by React's concurrent mode must not install its
  // callback, which would cause a stale closure to handle live events.
  useEffect(() => {
    callbackRef.current = callback;
    debounceRef.current = debounceMs;
    storyIdRef.current = storyId;
  });

  useEffect(() => {
    let mounted = true;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    function isForCurrentStory(updatedStory: LivePreviewStory<TStory>): boolean {
      return storyIdRef.current === undefined || updatedStory.id === storyIdRef.current;
    }

    // Synchronous, and never throws: Preview Bridge load failures go to
    // `bridgeOptions.onError` (`console.error` by default).
    const unsubscribe = onStoryblokEditorEvent<TStory>((updatedStory) => {
      if (!mounted) {
        return;
      }
      // Filtered before the debounce: an event for another story must not
      // clear the timer holding a pending update for this one.
      if (!isForCurrentStory(updatedStory)) {
        return;
      }
      if (skipWithoutContent && updatedStory.content == null) {
        return;
      }

      const ms = debounceRef.current;
      // Cleared for every event, not only debounced ones: if `debounceMs` was
      // removed since the timer started, the stale timer would otherwise fire
      // after this event and overwrite it with an older story.
      clearTimeout(debounceTimer);

      if (ms !== undefined) {
        debounceTimer = setTimeout(() => {
          // Checked again: a client-side navigation during the debounce
          // window may have moved this subscriber to another story.
          if (isForCurrentStory(updatedStory)) {
            callbackRef.current(updatedStory);
          }
        }, ms);
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
