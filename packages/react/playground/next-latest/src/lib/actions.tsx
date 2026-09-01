"use server";

import type { Story } from "@storyblok/react";
import type { LivePreviewStory } from "@storyblok/live-preview";
import type { ReactNode } from "react";
import { StoryContent } from "@/app/components/StoryContent";

export async function renderContent(story: LivePreviewStory): Promise<ReactNode> {
  // LivePreviewStory is the minimal bridge payload type; the bridge sends the
  // full story at runtime so the cast is safe.
  return <StoryContent story={story as unknown as Story} />;
}
