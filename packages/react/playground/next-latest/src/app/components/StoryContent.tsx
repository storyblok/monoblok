import { StoryblokComponent } from "@/lib/storyblok";
import type { LivePreviewStory } from "@storyblok/react";
import { Nav } from "@/app/components/Nav";

export function StoryContent({ story }: { story: LivePreviewStory }) {
  return (
    <main className="container mx-auto">
      <Nav />
      {story.content ? <StoryblokComponent block={story.content} /> : null}
    </main>
  );
}
