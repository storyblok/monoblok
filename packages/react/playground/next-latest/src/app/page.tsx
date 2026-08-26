import { apiClient, StoryblokComponent } from "@/lib/storyblok";
import type { StoryblokBlockData } from "@storyblok/react";
import Link from "next/link";

export default async function Home() {
  const result = await apiClient.stories.get("react", { query: { version: "draft" } });
  const story = result.data?.story;

  if (!story) return <div>Story not found.</div>;

  return (
    <main className="container mx-auto px-4 py-8">
      <h1>Storyblok Next.js Example</h1>
      <Link href="/react/richtext">Go to Rich Text Example</Link>
      <StoryblokComponent block={story.content} />
    </main>
  );
}
