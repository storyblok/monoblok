import type { StoryblokBlockData } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "../lib/storyblok";

const Page = ({ block }: { block: StoryblokBlockData }) => (
  <div {...storyblokEditable(block)} key={block._uid} data-test="page">
    {(block.body as StoryblokBlockData[] | undefined)?.map((nestedBlock) => (
      <StoryblokComponent key={nestedBlock._uid} block={nestedBlock} />
    ))}
  </div>
);

export default Page;
