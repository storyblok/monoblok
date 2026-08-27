import { StoryblokPreviewRsc } from "@storyblok/react/client";
import { renderContent } from "@/lib/actions";
import { apiClient, StoryblokComponent } from "@/lib/storyblok";

export default async function Home() {
  const result = await apiClient.stories.get("react", { query: { version: "draft" } });
  const story = result.data?.story;

  if (!story) return <div>Story not found.</div>;

  return (
    <StoryblokPreviewRsc renderContent={renderContent}>
      <main className="container mx-auto px-4 py-8">
        <h1>Storyblok Next.js Example</h1>
        <StoryblokComponent block={story.content} />
      </main>
    </StoryblokPreviewRsc>
  );
}
