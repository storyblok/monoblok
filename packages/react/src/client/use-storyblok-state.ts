"use client";

import type { Story } from "@storyblok/api-client";
import { useState } from "react";
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
  useStoryblokEditorEvent((updatedStory) => setCurrent(updatedStory), options);
  return current;
}
