import type { BlockContent, StoryblokBlockComponentProps } from "@storyblok/react";
import { StoryblokBlock } from "../lib/storyblok";

type PageProps = StoryblokBlockComponentProps<{ body?: BlockContent[] }>;

const Page = ({ block, editable }: PageProps) => (
  <div {...editable} data-test="page">
    {block.body?.map((nestedBlock) => (
      <StoryblokBlock key={nestedBlock._uid} block={nestedBlock} />
    ))}
  </div>
);

export default Page;
