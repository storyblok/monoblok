import React from "react";
import type { StoryblokBlockData, StoryblokRichTextInput } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";
import { StoryblokComponent, StoryblokRichText } from "../storyblok";

interface PageProps {
  block: StoryblokBlockData;
}

const Page = ({ block }: PageProps) => {
  const richText = block.richText as StoryblokRichTextInput | undefined;
  return (
    <div {...storyblokEditable(block)} key={block._uid} data-test="page">
      {block.body
        ? (block.body as StoryblokBlockData[]).map((nestedBlock) => (
            <div key={nestedBlock._uid}>
              <StoryblokComponent block={nestedBlock} />
            </div>
          ))
        : null}
      {richText ? <StoryblokRichText document={richText} /> : null}
    </div>
  );
};

export default Page;
