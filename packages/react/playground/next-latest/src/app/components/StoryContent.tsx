import type { Story } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";

export function StoryContent({ story }: { story: Story }) {
  return <StoryblokComponent block={story.content} />;
}
