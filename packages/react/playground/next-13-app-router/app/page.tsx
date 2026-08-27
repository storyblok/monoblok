import { apiClient } from "@/lib/storyblok";
import { StoryContent } from "@/components/StoryContent";

export default async function Home() {
  const result = await apiClient.stories.get("react", { query: { version: "draft" } });
  const story = result.data?.story;

  if (!story) return <div>Story not found.</div>;

  return <StoryContent story={story} />;
}
