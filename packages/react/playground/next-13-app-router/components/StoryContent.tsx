"use client";

import { StoryblokPreview, type Story } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";

export function StoryContent({ story }: { story: Story }) {
  return (
    <StoryblokPreview
      key={story.uuid}
      story={story}
      renderContent={(live) => <StoryblokComponent block={live.content} />}
    />
  );
}
