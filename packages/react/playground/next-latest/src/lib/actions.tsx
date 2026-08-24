"use server";

import type { ReactNode } from "react";
import type { Story } from "@storyblok/react";
import { StoryContent } from "@/app/components/StoryContent";

export async function renderContent(story: Story): Promise<ReactNode> {
  return <StoryContent story={story} />;
}
