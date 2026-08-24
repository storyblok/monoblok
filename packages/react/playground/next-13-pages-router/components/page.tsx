import type { BlockContent } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent } from "../lib/storyblok";

const Page = ({ block }: { block: BlockContent }) => (
  <div {...storyblokEditable(block)} key={block._uid} data-test="page">
    {(block.body as BlockContent[] | undefined)?.map((nested) => (
      <StoryblokComponent key={nested._uid} block={nested} />
    ))}
  </div>
);

export default Page;
