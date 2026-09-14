import { StoryblokComponent } from "@/lib/storyblok";
import { type Story, type BlockContent } from "@storyblok/react";
import { Nav } from "@/app/components/Nav";

type StoryContentProps = { story: Story };

export function StoryContent({ story }: StoryContentProps) {
  return (
    <main className="container mx-auto">
      <Nav />
      {/* story.content resolves to BlockContent<RootBlock> (distributed form);
          cast to the base BlockContent shape that StoryblokComponent expects. */}
      <StoryblokComponent block={story.content as BlockContent} />
    </main>
  );
}
