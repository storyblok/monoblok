import React from "react";
import type { BlockContent } from "@storyblok/react";
import { storyblokEditable } from "@storyblok/react";

interface TeaserProps {
  block: BlockContent;
}

const Teaser = ({ block }: TeaserProps) => {
  return (
    <div {...storyblokEditable(block)} key={block._uid} data-test="teaser">
      <div>
        <h2>{block.headline as string}</h2>
      </div>
    </div>
  );
};

export default Teaser;
