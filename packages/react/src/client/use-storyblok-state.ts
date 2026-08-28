"use client";

import type { Story } from "@storyblok/api-client";
import { useEffect, useState } from "react";
import {
  useStoryblokEditorEvent,
  type UseStoryblokEditorEventOptions,
} from "./use-storyblok-editor-event";

/** Options for {@link useStoryblokState}. */
export interface UseStoryblokStateOptions extends UseStoryblokEditorEventOptions {}

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
 *   return <StoryblokComponent block={live.content} />;
 * }
 * ```
 */
export function useStoryblokState(story: Story, options: UseStoryblokStateOptions = {}): Story {
  const [current, setCurrent] = useState(story);

  // Sync the prop into state when the story identity changes.
  // useState only uses the initial value on mount, so cross-route navigation
  // or SWR keepPreviousData swaps that change `story.id` would otherwise render
  // stale content forever on a reused component instance.
  useEffect(() => {
    setCurrent(story);
  }, [story.id]); // oxlint-disable-line react-hooks/exhaustive-deps -- intentional: sync on id change only, not on every render-phase story reference

  useStoryblokEditorEvent((updatedStory) => setCurrent(updatedStory), options);
  return current;
}
