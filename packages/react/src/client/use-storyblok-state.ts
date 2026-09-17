"use client";

import { useEffect, useState } from "react";
import type { LivePreviewStory } from "@storyblok/live-preview";
import type { Story } from "../types";
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
export function useStoryblokState(
  story: Story,
  options: UseStoryblokStateOptions = {},
): LivePreviewStory<Story> {
  const [current, setCurrent] = useState<LivePreviewStory<Story>>(story);

  // Sync a new prop snapshot without overwriting editor updates on every render.
  // useState only uses the initial value on mount, so cross-route navigation
  // or SWR refetches would otherwise render stale content forever on a reused
  // component instance.
  useEffect(() => {
    setCurrent(story);
  }, [story]);

  useStoryblokEditorEvent<Story>(
    (updatedStory) => setCurrent((prev) => ({ ...prev, ...updatedStory })),
    options,
  );
  return current;
}
