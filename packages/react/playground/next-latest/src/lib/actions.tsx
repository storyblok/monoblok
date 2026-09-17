"use server";

import type { LivePreviewStory } from "@storyblok/react";
import type { ReactNode } from "react";
import { StoryContent } from "@/app/components/StoryContent";

export async function renderContent(story: LivePreviewStory): Promise<ReactNode> {
  return story.content ? <StoryContent story={story} /> : null;
}
