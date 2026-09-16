import { StoryblokComponent } from "@/lib/storyblok";
import type { StoryblokBlock } from "@storyblok/react";
import { Nav } from "@/app/components/Nav";

type StoryContentProps = { story: { content?: StoryblokBlock } };

export function StoryContent({ story }: StoryContentProps) {
  return (
    <main className="container mx-auto">
      <Nav />
      {story.content ? <StoryblokComponent block={story.content} /> : null}
    </main>
  );
}
