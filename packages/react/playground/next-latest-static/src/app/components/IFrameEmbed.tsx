import React from "react";
import type { StoryblokBlockData } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

interface IframeEmbedProps {
  block: StoryblokBlockData & {
    url?: {
      url?: string;
      title?: string;
    };
  };
}

const IFrameEmbed = ({ block }: IframeEmbedProps) => {
  const urlObject = block?.url as { url?: string; title?: string } | undefined;

  return (
    <div {...storyblokEditable(block)} key={block._uid} data-test="iframe-embed">
      <div>
        <iframe src={urlObject?.url} title={urlObject?.title} />
      </div>
    </div>
  );
};

export default IFrameEmbed;
