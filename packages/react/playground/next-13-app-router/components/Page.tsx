import type { StoryblokBlockData, StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "@/lib/storyblok";

type PageProps = StoryblokComponentProps<{ body: StoryblokBlockData[] }>;

const Page = ({ block }: PageProps) => (
  <main {...storyblokEditable(block)}>
    {block.body.map((nestedBlock) => (
      <StoryblokComponent block={nestedBlock} key={nestedBlock._uid} />
    ))}
  </main>
);

export default Page;
