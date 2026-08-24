import React from "react";
import type { BlockContent, StoryblokRichTextInput } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent, StoryblokRichText } from "../lib/storyblok";

interface PageProps {
  block: BlockContent;
}

const Page = ({ block }: PageProps) => {
  const richText = block.richText as StoryblokRichTextInput;
  return (
    <div {...storyblokEditable(block)} key={block._uid} data-test="page">
      {block.body
        ? (block.body as BlockContent[]).map((item) => (
            <StoryblokComponent key={item._uid} block={item} />
          ))
        : null}
      {richText ? <StoryblokRichText document={richText} /> : null}
    </div>
  );
};

export default Page;
