"use client";

import { StoryblokPreview, type Story } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";

export function StoryContent({ story }: { story: Story }) {
  return (
    <StoryblokPreview
      story={story}
      renderContent={(live) => (live.content ? <StoryblokComponent block={live.content} /> : null)}
    />
  );
}
