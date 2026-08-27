"use server";

import type { Story } from "@storyblok/react";
import type { ReactNode } from "react";
import { StoryContent } from "@/app/components/StoryContent";

export async function renderContent(story: Story): Promise<ReactNode> {
  return <StoryContent story={story} />;
}
