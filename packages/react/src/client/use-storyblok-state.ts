"use client";

import { onStoryblokEditorEvent } from "@storyblok/live-preview";
import type { Story } from "@storyblok/api-client";
import { useEffect, useState } from "react";

/**
 * Subscribes to Storyblok Visual Editor events and returns the latest story.
 *
 * Pass the initially fetched story (from your server component, route loader,
 * or data-fetching hook). On every editor update the returned value is replaced
 * with the updated story — triggering a re-render of the calling component.
 *
 * @example
 * ```tsx
 * "use client";
 * function Page({ story }: { story: Story }) {
 *   const live = useStoryblokState(story);
 *   return <StoryblokComponent blok={live.content} />;
 * }
 * ```
 */
export function useStoryblokState(story: Story): Story {
  const [current, setCurrent] = useState(story);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      unsubscribe = await onStoryblokEditorEvent((updatedStory) => {
        if (!mounted) return;
        setCurrent(updatedStory as Story);
      });
    };

    setup();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  return current;
}
