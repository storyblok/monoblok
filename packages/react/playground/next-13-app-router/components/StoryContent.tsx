"use client";

import { StoryblokPreview, type Story } from "@storyblok/react";
import { StoryblokBlock } from "@/lib/storyblok";

export function StoryContent({ story }: { story: Story }) {
  return (
    <StoryblokPreview
      story={story}
      renderContent={(live) => (live.content ? <StoryblokBlock block={live.content} /> : null)}
    />
  );
}
