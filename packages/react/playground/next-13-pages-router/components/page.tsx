import type { BlockContent, StoryblokComponentProps } from "@storyblok/react";
import { StoryblokComponent } from "../lib/storyblok";

type PageProps = StoryblokComponentProps<{ body?: BlockContent[] }>;

const Page = ({ block, editable }: PageProps) => (
  <div {...editable} data-test="page">
    {block.body?.map((nestedBlock) => (
      <StoryblokComponent key={nestedBlock._uid} block={nestedBlock} />
    ))}
  </div>
);

export default Page;
