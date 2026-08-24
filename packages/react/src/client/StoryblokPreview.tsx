"use client";

import type { Story } from "@storyblok/api-client";
import type { ReactNode } from "react";
import { useStoryblokState } from "./use-storyblok-state";

export interface StoryblokPreviewProps {
  /**
   * Initial story fetched by the application.
   */
  story: Story;

  /**
   * Render function that receives the latest story.
   */
  children: (story: Story) => ReactNode;
}

export function StoryblokPreview({ story, children }: StoryblokPreviewProps) {
  const current = useStoryblokState(story);
  return <>{children(current)}</>;
}

export default StoryblokPreview;
