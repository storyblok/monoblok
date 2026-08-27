import { apiClient, StoryblokComponent } from "@/lib/storyblok";
import Link from "next/link";

export default async function RichtextPage() {
  const result = await apiClient.stories.get("richtext", { query: { version: "draft" } });
  const story = result.data?.story;

  if (!story) return <div>Story not found.</div>;

  return (
    <div>
      <h1>Rich Text Example</h1>
      <Link href="/">Go to Home</Link>
      <StoryblokComponent block={story.content} />
    </div>
  );
}
