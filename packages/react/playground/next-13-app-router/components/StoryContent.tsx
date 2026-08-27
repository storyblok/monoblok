"use client";

import type { Story } from "@storyblok/react";
import { StoryblokPreview } from "@storyblok/react/client";
import { StoryblokComponent } from "@/lib/storyblok";

export function StoryContent({ story }: { story: Story }) {
  return (
    <StoryblokPreview key={story.uuid} story={story}>
      {(live) => <StoryblokComponent block={live.content} />}
    </StoryblokPreview>
  );
}
