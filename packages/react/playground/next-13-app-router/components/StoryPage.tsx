"use client";

import type { Story } from "@storyblok/react";
import { StoryblokPreview } from "@storyblok/react/client";
import { StoryblokComponent } from "@/lib/storyblok";

export function StoryPage({ story }: { story: Story }) {
  return (
    <StoryblokPreview story={story}>
      {(live) => (
        <div>
          <h1>Story: {live.id}</h1>
          <StoryblokComponent block={live.content} />
        </div>
      )}
    </StoryblokPreview>
  );
}
