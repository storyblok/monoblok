import { apiClient, StoryblokComponent } from "@/lib/storyblok";
import type { StoryblokBlockData } from "@storyblok/react";
import Link from "next/link";

export default async function Home() {
  const result = await apiClient.stories.get("react", { query: { version: "draft" } });
  const story = result.data?.story;

  if (!story) return <div>Story not found.</div>;

  return (
    <main>
      <h1>Storyblok Next.js Static Export Example</h1>
      <Link href="/react/richtext">Go to Rich Text Example</Link>
      <StoryblokComponent block={story.content as StoryblokBlockData} />
    </main>
  );
}
