import type { Story } from "@storyblok/react";
import { client, StoryblokComponent } from "@/lib/storyblok";

export default async function Home() {
  const { data } = await client.get("cdn/stories/home", { version: "draft" });
  const story = data.story as Story | undefined;

  if (!story) return <div>Story not found</div>;

  return (
    <div>
      <h1>Story: {story.id}</h1>
      <StoryblokComponent block={story.content} />
    </div>
  );
}
