import type { StoryblokBlockData, StoryblokComponentProps } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "../lib/storyblok";

type PageProps = StoryblokComponentProps<{ body?: StoryblokBlockData[] }>;

const Page = ({ block }: PageProps) => (
  <div {...storyblokEditable(block)} data-test="page">
    {block.body?.map((nestedBlock) => (
      <StoryblokComponent key={nestedBlock._uid} block={nestedBlock} />
    ))}
  </div>
);

export default Page;
