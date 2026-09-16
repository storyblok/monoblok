"use client";

import { StoryblokPreview, type StoryblokPreviewStory } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";

export function StoryContent({ story }: { story: StoryblokPreviewStory }) {
  return (
    <StoryblokPreview
      story={story}
      renderContent={(live) => (live.content ? <StoryblokComponent block={live.content} /> : null)}
    />
  );
}
