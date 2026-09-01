"use client";

import type { Story } from "@storyblok/api-client";
import type { ReactNode } from "react";
import { useStoryblokState, type UseStoryblokStateOptions } from "./use-storyblok-state";

/** Props for the {@link StoryblokPreview} component. */
export interface StoryblokPreviewProps extends UseStoryblokStateOptions {
  /**
   * Initial story fetched by the application.
   */
  story: Story;

  /**
   * Render function that receives the latest story.
   */
  children: (story: Story) => ReactNode;
}

/**
 * Client component that subscribes to Storyblok Visual Editor events and
 * re-renders its children with the latest story on every editor update.
 *
 * Pass the initially fetched story and a render-prop children function. The
 * component holds the live story in state and calls children with it on every
 * editor update, so your UI stays in sync with the Visual Editor without a
 * full page reload.
 *
 * @example
 * ```tsx
 * <StoryblokPreview story={story}>
 *   {(live) => <StoryblokComponent block={live.content} />}
 * </StoryblokPreview>
 * ```
 */
export function StoryblokPreview({ story, children, ...options }: StoryblokPreviewProps) {
  const current = useStoryblokState(story, options);
  return <>{children(current)}</>;
}
