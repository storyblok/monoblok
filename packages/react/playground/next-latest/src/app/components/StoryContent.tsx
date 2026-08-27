import { StoryblokComponent } from "@/lib/storyblok";
import { type Story } from "@storyblok/react";
import { Nav } from "@/app/components/Nav";

type StoryContentProps = { story: Story };

export function StoryContent({ story }: StoryContentProps) {
  return (
    <main className="container mx-auto">
      <Nav />
      <StoryblokComponent block={story.content} />
    </main>
  );
}
