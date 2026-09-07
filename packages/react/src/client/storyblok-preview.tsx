"use client";

import type { ReactNode } from "react";
import type { Story } from "../types";
import { useStoryblokState, type UseStoryblokStateOptions } from "./use-storyblok-state";

/** Props for the {@link StoryblokPreview} component. */
export interface StoryblokPreviewProps extends UseStoryblokStateOptions {
  /**
   * Initial story fetched by the application.
   */
  story: Story;
  /**
   * Render function that receives the latest story on every Visual Editor
   * update and returns the UI for it.
   */
  renderContent: (story: Story) => ReactNode;
}

/**
 * Client component that subscribes to Storyblok Visual Editor events and
 * re-renders its content with the latest story on every editor update.
 *
 * Pass the initially fetched story and a `renderContent` function. The
 * component holds the live story in state and calls `renderContent` with it
 * on every editor update, so your UI stays in sync with the Visual Editor
 * without a full page reload.
 *
 * For RSC routes driven by a Server Action, use `StoryblokPreview` from
 * `@storyblok/react/rsc` instead — same props shape (`story` +
 * `renderContent`), but `renderContent` there is `async` and reruns on the
 * server.
 *
 * @example
 * ```tsx
 * <StoryblokPreview story={story} renderContent={(live) => <StoryblokComponent block={live.content} />} />
 * ```
 */
export function StoryblokPreview({
  story,
  renderContent,
  ...options
}: StoryblokPreviewProps): ReactNode {
  const current = useStoryblokState(story, options);
  return <>{renderContent(current)}</>;
}
