import { StoryContent } from "@/components/StoryContent";
import { apiClient } from "@/lib/storyblok";

export default async function CatchAllPage({ params }: { params: { slug?: string[] } }) {
  const storySlug = params.slug?.join("/") || "react";
  const result = await apiClient.stories.get(storySlug, { query: { version: "draft" } });
  const story = result.data?.story;

  if (!story) return <div>Story not found.</div>;

  return <StoryContent story={story} />;
}
