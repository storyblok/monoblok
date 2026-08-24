"use client";

import { StoryblokPreview } from "@storyblok/react/client";
import { useStoryblokStory } from "@/lib/use-storyblok-story";
import { StoryblokComponent } from "@/lib/storyblok";

export default function Home() {
  const { data: story, isLoading } = useStoryblokStory("home");

  if (isLoading || !story) return <div>Loading...</div>;

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
