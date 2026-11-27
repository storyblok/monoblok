import type { BlockContent, StoryblokBlockComponentProps } from "@storyblok/react";
import { StoryblokBlock } from "@/lib/storyblok";

type PageProps = StoryblokBlockComponentProps<{ body: BlockContent[] }>;

const Page = ({ block, editable }: PageProps) => (
  <main {...editable}>
    {block.body.map((nestedBlock) => (
      <StoryblokBlock block={nestedBlock} key={nestedBlock._uid} />
    ))}
  </main>
);

export default Page;
