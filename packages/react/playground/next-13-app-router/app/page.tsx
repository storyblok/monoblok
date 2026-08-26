import { apiClient, StoryblokComponent } from "@/lib/storyblok";
import type { StoryblokBlockData } from "@storyblok/react";

export default async function Home() {
  const result = await apiClient.stories.get("react", { query: { version: "draft" } });
  const story = result.data?.story;

  if (!story) return <div>Story not found.</div>;

  return (
    <div>
      <h1>Story: {story.name}</h1>
      <StoryblokComponent block={story.content as StoryblokBlockData} />
    </div>
  );
}
