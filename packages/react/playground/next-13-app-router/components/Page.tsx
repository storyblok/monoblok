import type { StoryblokBlockData } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";

interface PageProps {
  block: StoryblokBlockData & { body: StoryblokBlockData[] };
}

const Page = ({ block }: PageProps) => (
  <main {...storyblokEditable(block)}>
    {block.body.map((nestedBlock) => (
      <StoryblokComponent block={nestedBlock} key={nestedBlock._uid} />
    ))}
  </main>
);

export default Page;
