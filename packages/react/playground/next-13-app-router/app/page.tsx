import type { Story } from "@storyblok/react";
import { client } from "@/lib/storyblok";
import { StoryPage } from "@/components/StoryPage";

export default async function Home() {
  const { data } = await client.get("cdn/stories/home", { version: "draft" });
  const story = data.story as Story | undefined;

  if (!story) return <div>Story not found</div>;

  return <StoryPage story={story} />;
}
