import React from "react";
import type { StoryblokBlockData } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

interface IframeEmbedBlok extends StoryblokBlockData {
  url?: { url?: string; title?: string };
}

interface IframeEmbedProps {
  block: IframeEmbedBlok;
}

const IFrameEmbed = ({ block }: IframeEmbedProps) => {
  return (
    <div {...storyblokEditable(block)} key={block._uid} data-test="iframe-embed">
      <div>
        <iframe src={block?.url?.url} title={block?.url?.title} />
      </div>
    </div>
  );
};

export default IFrameEmbed;
