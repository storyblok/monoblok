"use client";

import { onStoryblokEditorEvent } from "@storyblok/live-preview";
import type { BridgeParams } from "@storyblok/live-preview";
import type { Story } from "@storyblok/api-client";
import { useEffect, useRef } from "react";

/** Options for {@link useStoryblokEditorEvent}. */
export interface UseStoryblokEditorEventOptions {
  /**
   * Milliseconds to wait after the last editor event before invoking the
   * callback. When omitted the callback is invoked immediately on every event.
   */
  debounceMs?: number;
  /**
   * Configuration forwarded to the Preview Bridge constructor.
   * Captured at mount time — changes after mount have no effect.
   */
  bridgeOptions?: BridgeParams;
}

/**
 * Subscribes to Storyblok Visual Editor events and calls `callback` with the
 * updated story. Handles async setup, the mounted guard, optional debouncing,
 * and unsubscription on unmount.
 *
 * Both `callback` and `options.debounceMs` are tracked via refs so the
 * subscription is established once on mount and never torn down/re-created
 * unless the component unmounts.
 */
export function useStoryblokEditorEvent(
  callback: (story: Story) => void,
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
    let unsubscribe: (() => void) | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const setup = async () => {
      const fn = await onStoryblokEditorEvent((updatedStory) => {
        if (!mounted) return;

        const ms = debounceRef.current;

        if (ms !== undefined) {
          if (debounceTimer !== null) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            debounceTimer = null;
            if (!mounted) return;
            callbackRef.current(updatedStory as Story);
          }, ms);
        } else {
          callbackRef.current(updatedStory as Story);
        }
      }, bridgeOptions);

      if (!mounted) {
        fn();
      } else {
        unsubscribe = fn;
      }
    };

    setup();

    return () => {
      mounted = false;
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      unsubscribe?.();
    };
  }, []);
}
